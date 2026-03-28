from uuid import UUID

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Domain, ScanResult, SecurityScore, User
from app.routers.auth import get_current_user
from app.tasks.celery_app import celery_app
from app.tasks.scan_tasks import run_full_scan

router = APIRouter()


class StartScanRequest(BaseModel):
    domain_name: str


class StartScanResponse(BaseModel):
    task_id: str
    domain_id: UUID


@router.get("/recent-domain")
async def recent_domain(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.execute(
        select(Domain)
        .where(Domain.user_id == current_user.id)
        .order_by(Domain.last_scanned_at.desc().nullslast(), Domain.created_at.desc())
        .limit(1)
    )
    domain = row.scalar_one_or_none()
    if domain is None:
        return None
    return {
        "domain_id": str(domain.id),
        "domain_name": domain.domain_name,
        "last_scanned_at": domain.last_scanned_at.isoformat() if domain.last_scanned_at else None,
    }


@router.post("/start", response_model=StartScanResponse)
async def start_scan(
    payload: StartScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.domain_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain name is required.")

    existing = await db.execute(
        select(Domain).where(
            Domain.user_id == current_user.id,
            Domain.domain_name == payload.domain_name.strip().lower(),
        )
    )
    domain = existing.scalar_one_or_none()

    if domain is None:
        domain = Domain(user_id=current_user.id, domain_name=payload.domain_name.strip().lower())
        db.add(domain)
        await db.commit()
        await db.refresh(domain)

    task = run_full_scan.delay(str(domain.id), domain.domain_name)
    return StartScanResponse(task_id=task.id, domain_id=domain.id)


@router.get("/status/{task_id}")
async def scan_status(task_id: str, current_user: User = Depends(get_current_user)):
    _ = current_user
    result = AsyncResult(task_id, app=celery_app)
    response: dict[str, object] = {"task_id": task_id, "status": result.status}
    if result.ready():
        response["result"] = result.result
    return response


@router.get("/{domain_id}/results")
async def scan_results(
    domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = await db.execute(select(Domain).where(Domain.id == domain_id, Domain.user_id == current_user.id))
    if domain.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found.")

    rows = await db.execute(
        select(ScanResult).where(ScanResult.domain_id == domain_id).order_by(ScanResult.created_at.desc())
    )
    result_rows = rows.scalars().all()
    return [
        {
            "id": str(item.id),
            "domain_id": str(item.domain_id),
            "scan_type": item.scan_type.value if hasattr(item.scan_type, "value") else str(item.scan_type),
            "severity": item.severity.value if hasattr(item.severity, "value") else str(item.severity),
            "raw_data": item.raw_data,
            "created_at": item.created_at.isoformat(),
        }
        for item in result_rows
    ]


@router.get("/{domain_id}/score")
async def latest_score(
    domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = await db.execute(select(Domain).where(Domain.id == domain_id, Domain.user_id == current_user.id))
    if domain.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found.")

    score_row = await db.execute(
        select(SecurityScore)
        .where(SecurityScore.domain_id == domain_id)
        .order_by(SecurityScore.created_at.desc())
        .limit(1)
    )
    score = score_row.scalar_one_or_none()
    if score is None:
        # Domain exists but no score row yet (scan failed before commit, or still writing). Avoid 404 so the UI can poll gracefully.
        return {
            "pending": True,
            "id": None,
            "domain_id": str(domain_id),
            "total_score": None,
            "ssl_score": None,
            "email_score": None,
            "headers_score": None,
            "dns_score": None,
            "ports_score": None,
            "created_at": None,
        }

    return {
        "pending": False,
        "id": str(score.id),
        "domain_id": str(score.domain_id),
        "total_score": score.total_score,
        "ssl_score": score.ssl_score,
        "email_score": score.email_score,
        "headers_score": score.headers_score,
        "dns_score": score.dns_score,
        "ports_score": score.ports_score,
        "created_at": score.created_at.isoformat(),
    }


@router.get("/{domain_id}/history")
async def score_history(
    domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = await db.execute(select(Domain).where(Domain.id == domain_id, Domain.user_id == current_user.id))
    if domain.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found.")

    history_rows = await db.execute(
        select(SecurityScore)
        .where(SecurityScore.domain_id == domain_id)
        .order_by(SecurityScore.created_at.desc())
        .limit(30)
    )
    history = history_rows.scalars().all()
    return [
        {
            "id": str(item.id),
            "domain_id": str(item.domain_id),
            "total_score": item.total_score,
            "ssl_score": item.ssl_score,
            "email_score": item.email_score,
            "headers_score": item.headers_score,
            "dns_score": item.dns_score,
            "ports_score": item.ports_score,
            "created_at": item.created_at.isoformat(),
        }
        for item in history
    ]
