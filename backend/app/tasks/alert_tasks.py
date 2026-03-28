import logging

import resend
from sqlalchemy import select

from app.config import settings
from app.database import create_worker_async_engine_and_sessionmaker
from app.models import Domain, User
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task
def send_crisis_alert(domain_id: str, event_type: str, description: str):
    """
    Virtual Security Officer — fetches domain + user email from DB,
    sends alert email via Resend with:
    subject: "Virtual Security Officer Alert: [domain]"
    HTML body: describes the crisis event with a link to the dashboard
    """
    import asyncio
    from uuid import UUID

    async def _run():
        worker_engine, SessionLocal = create_worker_async_engine_and_sessionmaker()
        try:
            async with SessionLocal() as db:
                result = await db.execute(
                    select(Domain, User).join(User, Domain.user_id == User.id).where(Domain.id == UUID(domain_id))
                )
                row = result.first()
                if row is None:
                    return {"status": "skipped", "reason": "domain_not_found"}
                domain, user = row

                if not settings.resend_api_key or settings.resend_api_key.startswith("your-"):
                    logger.warning("Resend skipped: RESEND_API_KEY not configured")
                    return {"status": "skipped", "reason": "resend_not_configured"}

                resend.api_key = settings.resend_api_key
                subject = f"Virtual Security Officer Alert: {domain.domain_name}"
                dashboard = settings.public_app_url.rstrip("/")
                html = (
                    f"<h2>Virtual Security Officer Crisis Alert</h2>"
                    f"<p><strong>Domain:</strong> {domain.domain_name}</p>"
                    f"<p><strong>Event Type:</strong> {event_type}</p>"
                    f"<p><strong>Description:</strong> {description}</p>"
                    f"<p>Review details in your dashboard: "
                    f"<a href='{dashboard}/'>Virtual Security Officer Dashboard</a></p>"
                )

                try:
                    resend.Emails.send(
                        {
                            "from": settings.resend_from_address,
                            "to": [user.email],
                            "subject": subject,
                            "html": html,
                        }
                    )
                except Exception as exc:
                    logger.warning("Crisis alert email not sent (%s): %s", type(exc).__name__, exc)
                    return {"status": "skipped", "reason": "resend_send_failed", "detail": str(exc)}

                return {"status": "sent", "to": user.email, "domain": domain.domain_name}
        finally:
            await worker_engine.dispose()

    return asyncio.run(_run())
