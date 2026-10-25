"""AI Website Chaos Tester -- FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.api import api_router
from app.api.auth import router as auth_router

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup: create all tables if they don't exist ---
    from app.db.session import engine
    from app.db.migrate import ensure_project_owner_column, ensure_failure_classification_columns
    from app.models.base import Base
    from app.models import (  # noqa: F401  ensure all mappers are loaded
        User, Project, TestRun, Page, Action, State, Failure, Evidence, BugReport
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(ensure_project_owner_column)
        await conn.run_sync(ensure_failure_classification_columns)
    logger.info("Database tables ready")
    try:
        from app.db.maintenance import fail_interrupted_runs
        interrupted = await fail_interrupted_runs()
        if interrupted:
            logger.warning("Marked interrupted runs as failed", count=interrupted)
    except Exception as exc:
        logger.error("Could not clean up interrupted runs", error=str(exc))
    logger.info("Starting AI Website Chaos Tester backend",
                mode="safe" if settings.safe_mode else "unsafe")
    yield
    # --- Shutdown ---
    await engine.dispose()
    logger.info("Shutting down backend")


app = FastAPI(
    title="AI Website Chaos Tester",
    description="Autonomous web application chaos testing framework",
    version="0.2.0",
    lifespan=lifespan,
)

# Auth uses a bearer token in the Authorization header (no cookies).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    from app.db.session import engine as _engine
    return {
        "status": "healthy",
        "service": "ai-chaos-tester",
        "version": "0.2.0",
        "safe_mode": settings.safe_mode,
        "database": _engine.dialect.name,
    }