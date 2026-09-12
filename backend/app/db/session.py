"""Database session and engine management."""
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Resolve database URL
db_url = settings.database_url

# Upgrade postgresql:// -> postgresql+asyncpg://
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
elif db_url.startswith("postgresql+psycopg://"):
    db_url = db_url.replace("postgresql+psycopg://", "postgresql+asyncpg://")

# On Windows local dev (no live Postgres), fall back to SQLite beside session.py
_is_local = "localhost" in db_url or "127.0.0.1" in db_url
if _is_local and not db_url.startswith("sqlite"):
    # Absolute path so it is stable regardless of the CWD uvicorn is launched from
    _db_dir = Path(__file__).resolve().parent   # backend/app/db/
    _db_path = (_db_dir / "chaosdb.db").as_posix()
    db_url = f"sqlite+aiosqlite:///{_db_path}"
    logger.info(f"Windows local dev: using SQLite at {_db_path}")

_is_sqlite = "sqlite" in db_url

engine = create_async_engine(
    db_url,
    echo=False,
    poolclass=NullPool if _is_sqlite else None,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)

async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async DB session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()