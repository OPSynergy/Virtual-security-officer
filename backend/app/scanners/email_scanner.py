from typing import Any

import dns.resolver


def _max_severity(current: str, incoming: str) -> str:
    order = {"pass": 0, "info": 1, "warning": 2, "critical": 3}
    return incoming if order[incoming] > order[current] else current


def scan_email_security(domain_name: str) -> dict[str, Any]:
    """Virtual Security Officer SPF, DKIM, and DMARC scan."""
    findings: list[dict[str, Any]] = []
    raw_data: dict[str, Any] = {"txt_records": [], "spf": None, "dkim_selectors": [], "dmarc": None}
    severity = "pass"

    resolver = dns.resolver.Resolver()

    txt_records: list[str] = []
    try:
        txt_answers = resolver.resolve(domain_name, "TXT")
        txt_records = ["".join([part.decode() for part in r.strings]) for r in txt_answers]
        raw_data["txt_records"] = txt_records
    except Exception:
        txt_records = []

    spf_record = next((r for r in txt_records if r.lower().startswith("v=spf1")), None)
    raw_data["spf"] = spf_record
    if spf_record is None:
        severity = _max_severity(severity, "critical")
        findings.append(
            {
                "title": "SPF record missing",
                "description": "No TXT record starting with v=spf1 was found.",
                "plain_english": "Your domain has no SPF record. This means anyone in the world can send emails pretending to be from your domain, damaging your reputation and tricking your customers.",
                "remediation_steps": [
                    "Publish an SPF TXT record with approved sender services.",
                    "Use `-all` or `~all` to control unauthorized senders.",
                ],
                "severity": "critical",
            }
        )
    elif "+all" in spf_record.lower():
        severity = _max_severity(severity, "warning")
        findings.append(
            {
                "title": "SPF policy too permissive",
                "description": f"SPF record contains +all: {spf_record}",
                "plain_english": "Virtual Security Officer found that your SPF policy effectively allows anyone to send mail as your domain.",
                "remediation_steps": [
                    "Replace +all with -all after validating authorized senders.",
                ],
                "severity": "warning",
            }
        )
    else:
        severity = _max_severity(severity, "pass")
        findings.append(
            {
                "title": "SPF record present",
                "description": f"SPF TXT record found: {spf_record}",
                "plain_english": "Virtual Security Officer confirmed an SPF policy is present for sender validation.",
                "remediation_steps": [
                    "Periodically review SPF includes and sender inventory.",
                ],
                "severity": "pass",
            }
        )

    selectors = ["default", "google", "mail", "dkim", "selector1", "selector2"]
    found_dkim: list[dict[str, str]] = []
    for selector in selectors:
        host = f"{selector}._domainkey.{domain_name}"
        try:
            dkim_answers = resolver.resolve(host, "TXT")
            records = ["".join([part.decode() for part in r.strings]) for r in dkim_answers]
            found_dkim.append({"selector": selector, "records": records})
        except Exception:
            continue
    raw_data["dkim_selectors"] = found_dkim

    if found_dkim:
        severity = _max_severity(severity, "info")
        findings.append(
            {
                "title": "DKIM selectors discovered",
                "description": f"Detected DKIM selectors: {[x['selector'] for x in found_dkim]}",
                "plain_english": "Virtual Security Officer found DKIM keys, which helps receiving mail servers verify legitimate messages.",
                "remediation_steps": [
                    "Rotate DKIM keys regularly.",
                    "Ensure all outbound providers use active DKIM signing.",
                ],
                "severity": "info",
            }
        )
    else:
        severity = _max_severity(severity, "warning")
        findings.append(
            {
                "title": "No common DKIM selectors found",
                "description": "Could not find DKIM TXT records for common selectors.",
                "plain_english": "Virtual Security Officer could not find DKIM setup in common locations, reducing email authenticity protections.",
                "remediation_steps": [
                    "Enable DKIM signing in your email platform.",
                    "Publish selector TXT records in DNS.",
                ],
                "severity": "warning",
            }
        )

    dmarc_host = f"_dmarc.{domain_name}"
    dmarc_record = None
    try:
        dmarc_answers = resolver.resolve(dmarc_host, "TXT")
        dmarc_records = ["".join([part.decode() for part in r.strings]) for r in dmarc_answers]
        dmarc_record = next((r for r in dmarc_records if r.lower().startswith("v=dmarc1")), None)
    except Exception:
        dmarc_record = None
    raw_data["dmarc"] = dmarc_record

    if dmarc_record is None:
        severity = _max_severity(severity, "critical")
        findings.append(
            {
                "title": "DMARC record missing",
                "description": f"No valid DMARC TXT record found at {dmarc_host}.",
                "plain_english": "Virtual Security Officer found no DMARC policy, so spoofed emails are less likely to be blocked by recipient systems.",
                "remediation_steps": [
                    "Publish a DMARC record with at least p=none to start reporting.",
                    "Move to quarantine/reject after tuning SPF and DKIM alignment.",
                ],
                "severity": "critical",
            }
        )
    elif "p=none" in dmarc_record.lower():
        severity = _max_severity(severity, "warning")
        findings.append(
            {
                "title": "DMARC policy is monitoring-only",
                "description": f"DMARC record uses p=none: {dmarc_record}",
                "plain_english": "Virtual Security Officer found DMARC in report-only mode, which monitors abuse but does not block spoofed messages.",
                "remediation_steps": [
                    "Transition DMARC policy to p=quarantine then p=reject when safe.",
                ],
                "severity": "warning",
            }
        )
    else:
        findings.append(
            {
                "title": "DMARC policy enforced",
                "description": f"DMARC record found: {dmarc_record}",
                "plain_english": "Virtual Security Officer confirmed your DMARC policy is configured to enforce anti-spoofing controls.",
                "remediation_steps": [
                    "Keep monitoring aggregate reports for alignment issues.",
                ],
                "severity": "pass",
            }
        )

    return {
        "scan_type": "spf_dkim",
        "status": "completed",
        "severity": severity,
        "findings": findings,
        "raw_data": raw_data,
    }
