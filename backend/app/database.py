from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base


def _to_async_database_url(url: str) -> str:
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


DATABASE_URL = _to_async_database_url(settings.database_url)
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, future=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def create_worker_async_engine_and_sessionmaker():
    """
    Fresh engine + sessionmaker for one Celery task invocation.
    The global engine must not be used across multiple asyncio.run() calls — asyncpg
    connections bind to one event loop; Celery runs each task in a new loop.
    """
    worker_engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, future=True)
    factory = async_sessionmaker(bind=worker_engine, class_=AsyncSession, expire_on_commit=False)
    return worker_engine, factory


async def get_db():
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()
