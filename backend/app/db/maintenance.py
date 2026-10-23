"""Startup housekeeping."""
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.test_run import RunStatus, TestRun


async def fail_interrupted_runs() -> int:
    """Runs that were RUNNING when the server stopped can never finish: mark them failed."""
    async with async_session_maker() as db:
        result = await db.execute(select(TestRun).where(TestRun.status == RunStatus.RUNNING))
        runs = list(result.scalars().all())
        now = datetime.now(timezone.utc)
        for run in runs:
            run.status = RunStatus.FAILED
            run.finished_at = now
            run.error_message = "The server restarted or ran out of memory while this run was in progress."
            if run.started_at:
                started = run.started_at if run.started_at.tzinfo else run.started_at.replace(tzinfo=timezone.utc)
                run.duration_ms = (now - started).total_seconds() * 1000
        await db.commit()
        return len(runs)