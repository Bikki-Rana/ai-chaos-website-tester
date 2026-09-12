"""TestRun service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.test_run import TestRun, RunStatus
from app.models.project import Project
from typing import List, Optional
from datetime import datetime, timezone

async def create_test_run(session: AsyncSession, project_id: str) -> Optional[TestRun]:
    # Ensure project exists
    project = await session.get(Project, project_id)
    if not project:
        return None
        
    run = TestRun(
        project_id=project_id,
        status=RunStatus.PENDING
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run

async def get_test_runs(session: AsyncSession, project_id: str) -> List[TestRun]:
    result = await session.execute(
        select(TestRun).where(TestRun.project_id == project_id).order_by(TestRun.created_at.desc())
    )
    return list(result.scalars().all())

async def get_test_run(session: AsyncSession, run_id: str) -> Optional[TestRun]:
    return await session.get(TestRun, run_id)

async def update_run_status(
    session: AsyncSession, 
    run_id: str, 
    status: RunStatus, 
    error_message: str = None
) -> Optional[TestRun]:
    run = await session.get(TestRun, run_id)
    if not run:
        return None
        
    run.status = status
    if status == RunStatus.RUNNING:
        run.started_at = datetime.now(timezone.utc)
    elif status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.STOPPED):
        run.finished_at = datetime.now(timezone.utc)
        if run.started_at:
            delta = run.finished_at - run.started_at
            run.duration_ms = delta.total_seconds() * 1000
    
    if error_message:
        run.error_message = error_message
        
    await session.commit()
    await session.refresh(run)
    return run