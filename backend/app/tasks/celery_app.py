from celery import Celery

from app.config import settings

celery_app = Celery(
    "virtual-security-officer",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="UTC",
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "scheduled-domain-scan-every-24h": {
            "task": "tasks.scan_tasks.scheduled_domain_scan",
            "schedule": 24 * 60 * 60,
        }
    },
)

# autodiscover_tasks() only imports packages' `tasks.py` modules, not `scan_tasks.py` / `alert_tasks.py`.
import app.tasks.alert_tasks  # noqa: F401
import app.tasks.scan_tasks  # noqa: F401
