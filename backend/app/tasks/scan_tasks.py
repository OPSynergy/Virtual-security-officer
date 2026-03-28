import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.database import create_worker_async_engine_and_sessionmaker
from app.models import CrisisEvent, Domain, ScanResult, ScanType, SecurityScore, SeverityType
from app.scanners import scan_dns, scan_email_security, scan_http_headers, scan_ports, scan_ssl
from app.scoring import calculate_score
from app.tasks.celery_app import celery_app


def _failure_result(scan_type: str, exc: Exception) -> dict[str, Any]:
    return {
        "scan_type": scan_type,
        "status": "failed",
        "severity": "warning",
        "findings": [
            {
                "title": f"{scan_type} scanner failed",
                "description": f"Virtual Security Officer scanner exception: {exc}",
                "plain_english": "Virtual Security Officer could not complete this scanner module, but continued with the remaining security checks.",
                "remediation_steps": [
                    "Review scanner task logs.",
                    "Validate connectivity and DNS for the target domain.",
                ],
                "severity": "warning",
            }
        ],
        "raw_data": {"error": str(exc)},
    }


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def run_full_scan(self, domain_id: str, domain_name: str):
    """
    Virtual Security Officer — Orchestrates all 5 scanner modules,
    saves results to DB, recalculates score, checks for crisis events.
    Steps: run ssl_scan, dns_scan, spf_dkim_scan, headers_scan, ports_scan
    Save each ScanResult to DB
    Call calculate_and_save_score(domain_id, results)
    Call check_crisis_events(domain_id, old_score, new_score, results)
    """

    async def _run():
        worker_engine, SessionLocal = create_worker_async_engine_and_sessionmaker()
        scan_sequence: list[tuple[str, Any]] = [
            ("ssl", scan_ssl),
            ("dns", scan_dns),
            ("spf_dkim", scan_email_security),
            ("headers", scan_http_headers),
            ("ports", scan_ports),
        ]
        scan_results: list[dict[str, Any]] = []
        for scan_type, scanner in scan_sequence:
            try:
                result = scanner(domain_name)
                result["scan_type"] = scan_type
                scan_results.append(result)
            except Exception as exc:
                scan_results.append(_failure_result(scan_type, exc))

        try:
            async with SessionLocal() as db:
                domain_result = await db.execute(select(Domain).where(Domain.id == UUID(domain_id)))
                domain = domain_result.scalar_one_or_none()
                if domain is None:
                    raise ValueError("Domain not found.")

                previous_score_row = await db.execute(
                    select(SecurityScore)
                    .where(SecurityScore.domain_id == UUID(domain_id))
                    .order_by(SecurityScore.created_at.desc())
                    .limit(1)
                )
                previous_score = previous_score_row.scalar_one_or_none()
                old_score = previous_score.total_score if previous_score else 0

                previous_critical_titles: set[str] = set()
                for scan_type in [ScanType.SSL, ScanType.DNS, ScanType.SPF_DKIM, ScanType.HEADERS, ScanType.PORTS]:
                    previous_scan_row = await db.execute(
                        select(ScanResult)
                        .where(ScanResult.domain_id == UUID(domain_id), ScanResult.scan_type == scan_type)
                        .order_by(ScanResult.created_at.desc())
                        .limit(1)
                    )
                    previous_scan = previous_scan_row.scalar_one_or_none()
                    if previous_scan and isinstance(previous_scan.raw_data, dict):
                        for finding in previous_scan.raw_data.get("findings", []):
                            if str(finding.get("severity", "")).lower() == "critical":
                                previous_critical_titles.add(str(finding.get("title", "")))

                for payload in scan_results:
                    scan_type = ScanType(payload["scan_type"])
                    sev_value = str(payload.get("severity", "info")).lower()
                    if sev_value not in {"critical", "warning", "info", "pass"}:
                        sev_value = "info"
                    db.add(
                        ScanResult(
                            domain_id=UUID(domain_id),
                            scan_type=scan_type,
                            severity=SeverityType(sev_value),
                            raw_data=payload,
                        )
                    )

                computed = calculate_score(scan_results)
                new_score = computed["total_score"]
                db.add(
                    SecurityScore(
                        domain_id=UUID(domain_id),
                        total_score=computed["total_score"],
                        ssl_score=computed["ssl_score"],
                        email_score=computed["email_score"],
                        headers_score=computed["headers_score"],
                        dns_score=computed["dns_score"],
                        ports_score=computed["ports_score"],
                    )
                )
                domain.last_scanned_at = datetime.now(timezone.utc)
                await db.commit()

            check_crisis_events.delay(
                domain_id,
                old_score,
                new_score,
                {
                    "scan_results": scan_results,
                    "previous_critical_titles": sorted(previous_critical_titles),
                    "findings_summary": computed["findings_summary"],
                },
            )
            return {"status": "complete", "domain_id": domain_id, "score": new_score}
        finally:
            await worker_engine.dispose()

    try:
        return asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(name="tasks.scan_tasks.scheduled_domain_scan")
def scheduled_domain_scan():
    """Fetches all domains from DB, dispatches run_full_scan for each"""

    async def _run():
        worker_engine, SessionLocal = create_worker_async_engine_and_sessionmaker()
        try:
            dispatched: list[str] = []
            async with SessionLocal() as db:
                result = await db.execute(select(Domain))
                domains = result.scalars().all()
                for domain in domains:
                    run_full_scan.delay(str(domain.id), domain.domain_name)
                    dispatched.append(str(domain.id))
            return {"dispatched_domain_ids": dispatched}
        finally:
            await worker_engine.dispose()

    return asyncio.run(_run())


@celery_app.task
def check_crisis_events(domain_id: str, old_score: int, new_score: int, results: dict):
    """Checks crisis conditions and triggers alerts"""

    async def _run():
        scan_results = results.get("scan_results", []) if isinstance(results, dict) else []
        previous_critical_titles = set(results.get("previous_critical_titles", [])) if isinstance(results, dict) else set()
        events: list[tuple[str, str]] = []

        if new_score < (old_score - 15):
            events.append(
                (
                    "score_drop",
                    f"Virtual Security Officer detected a score drop from {old_score} to {new_score}.",
                )
            )

        new_critical_titles: set[str] = set()
        ssl_expiry_triggered = False
        for scan in scan_results:
            for finding in scan.get("findings", []):
                finding_severity = str(finding.get("severity", "")).lower()
                title = str(finding.get("title", ""))
                description = str(finding.get("description", "")).lower()
                if finding_severity == "critical":
                    if title and title not in previous_critical_titles:
                        new_critical_titles.add(title)
                    if scan.get("scan_type") == "ssl" and ("expires in" in description or "<7" in description):
                        ssl_expiry_triggered = True

        if new_critical_titles:
            events.append(
                (
                    "new_critical",
                    f"Virtual Security Officer identified new critical findings: {sorted(new_critical_titles)}",
                )
            )
        if ssl_expiry_triggered:
            events.append(
                (
                    "ssl_expiry",
                    "Virtual Security Officer detected SSL certificate expiry risk under 7 days.",
                )
            )

        if not events:
            return {"domain_id": domain_id, "events_created": 0}

        worker_engine, SessionLocal = create_worker_async_engine_and_sessionmaker()
        try:
            async with SessionLocal() as db:
                for event_type, description in events:
                    db.add(
                        CrisisEvent(
                            domain_id=UUID(domain_id),
                            event_type=event_type,
                            description=description,
                            resolved=False,
                        )
                    )
                await db.commit()
        finally:
            await worker_engine.dispose()

        from app.tasks.alert_tasks import send_crisis_alert

        for event_type, description in events:
            send_crisis_alert.delay(domain_id, event_type, description)

        return {"domain_id": domain_id, "events_created": len(events), "events": [e[0] for e in events]}

    return asyncio.run(_run())
