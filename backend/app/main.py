"""AI Website Chaos Tester -- FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.api import api_router

logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup: create all tables if they don't exist ──────────────────────
    from app.db.session import engine
    from app.models.base import Base
    from app.models import (  # noqa: F401  ensure all mappers are loaded
        Project, TestRun, Page, Action, State, Failure, Evidence, BugReport
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")
    logger.info("Starting AI Website Chaos Tester backend",
                mode="safe" if settings.safe_mode else "unsafe")
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    await engine.dispose()
    logger.info("Shutting down backend")

app = FastAPI(
    title="AI Website Chaos Tester",
    description="Autonomous web application chaos testing framework",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-chaos-tester",
        "version": "0.2.0",
        "safe_mode": settings.safe_mode,
    }