
"""Database session and engine management."""

import logging
import os
import ssl
from pathlib import Path
from typing import Any, Dict
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)


def normalize_database_url(database_url: str) -> str:
    """Convert supported PostgreSQL URLs to the asyncpg SQLAlchemy dialect."""
    url = database_url.strip()

    for prefix in (
        "postgresql+psycopg://",
        "postgresql+psycopg2://",
        "postgresql://",
        "postgres://",
    ):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]

    return url


def get_database_config(database_url: str):
    """Prepare database URL and driver-specific connection arguments."""
    db_url = normalize_database_url(database_url)

    parsed = urlparse(db_url)
    connect_args: Dict[str, Any] = {}

    # Use SQLite for local development when the configured database
    # points to localhost. Do not silently fall back on Render.
    if (
        parsed.scheme.startswith("postgresql")
        and parsed.hostname in ("localhost", "127.0.0.1", "::1")
        and not os.environ.get("RENDER")
    ):
        sqlite_path = (
            Path(__file__).resolve().parent / "chaosdb.db"
        ).as_posix()

        logger.info("Local development: using SQLite at %s", sqlite_path)
        return f"sqlite+aiosqlite:///{sqlite_path}", {
            "check_same_thread": False
        }

    if db_url.startswith("sqlite"):
        if os.environ.get("RENDER"):
            logger.warning(
                "SQLite is configured on Render. Local SQLite files may "
                "not persist across deployments. Configure DATABASE_URL "
                "to use persistent PostgreSQL."
            )

        return db_url, {"check_same_thread": False}

    if not db_url.startswith("postgresql+asyncpg://"):
        raise ValueError(
            "Unsupported DATABASE_URL. Use a PostgreSQL URL or "
            "sqlite+aiosqlite URL."
        )

    # asyncpg does not accept libpq's sslmode or channel_binding
    # as ordinary URL query parameters. Remove them before connecting.
    query_items = parse_qsl(parsed.query, keep_blank_values=True)
    clean_query = []
    sslmode = None
    ssl_option = None

    for key, value in query_items:
        key_lower = key.lower()

        if key_lower == "sslmode":
            sslmode = value.lower()
        elif key_lower == "ssl":
            ssl_option = value.lower()
        elif key_lower == "channel_binding":
            continue
        else:
            clean_query.append((key, value))

    clean_url = urlunparse(
        parsed._replace(query=urlencode(clean_query))
    )

    ssl_setting = sslmode or ssl_option

    if ssl_setting:
        if ssl_setting in ("disable", "false", "0"):
            connect_args["ssl"] = False

        elif ssl_setting in ("require", "true", "1"):
            # Encrypt the connection. This does not explicitly enforce
            # hostname/certificate verification.
            connect_args["ssl"] = True

        elif ssl_setting == "verify-ca":
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_REQUIRED
            connect_args["ssl"] = context

        elif ssl_setting == "verify-full":
            context = ssl.create_default_context()
            context.check_hostname = True
            context.verify_mode = ssl.CERT_REQUIRED
            connect_args["ssl"] = context

        elif ssl_setting in ("allow", "prefer"):
            # Prefer encrypted connections for these modes.
            # asyncpg does not reproduce libpq's full fallback behavior.
            connect_args["ssl"] = True

        else:
            raise ValueError(
                f"Unsupported PostgreSQL SSL setting: {ssl_setting}"
            )

    # Useful with transaction-pooling PostgreSQL providers.
    connect_args["statement_cache_size"] = 0

    return clean_url, connect_args


db_url, connect_args = get_database_config(settings.database_url)
_is_sqlite = db_url.startswith("sqlite")

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    poolclass=NullPool if _is_sqlite else None,
    pool_pre_ping=not _is_sqlite,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    """FastAPI dependency that yields a database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
