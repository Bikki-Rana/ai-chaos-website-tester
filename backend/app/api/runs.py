from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.schemas.test_run import TestRunRead, RunStartOptions
from app.schemas.page import PageRead
from app.schemas.action import ActionRead
from app.schemas.failure import FailureRead
from app.models.test_run import RunStatus
from app.services import test_run_service, page_service, action_service, failure_service, project_service
from app.browser.run_executor import execute_test_run

router = APIRouter(prefix="/runs", tags=["runs"])

@router.get("/{run_id}", response_model=TestRunRead)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await test_run_service.get_test_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@router.post("/{run_id}/start", response_model=TestRunRead)
async def start_run(
    run_id: str, 
    background_tasks: BackgroundTasks, 
    options: RunStartOptions,
    db: AsyncSession = Depends(get_db)
):
    run = await test_run_service.get_test_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot start run in state {run.status}")
    
    project = await project_service.get_project(db, run.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Mark as running immediately
    run = await test_run_service.update_run_status(db, run_id, RunStatus.RUNNING)
    
    # Kick off actual execution task
    background_tasks.add_task(
        execute_test_run,
        run_id=run.id,
        project_id=project.id,
        url=project.url,
        headless=True,
        max_pages=options.max_pages,
        max_depth=options.max_depth
    )
    
    return run

@router.post("/{run_id}/stop", response_model=TestRunRead)
async def stop_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await test_run_service.get_test_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Can only stop a RUNNING run")
        
    return await test_run_service.update_run_status(db, run_id, RunStatus.STOPPED)

@router.get("/{run_id}/pages", response_model=List[PageRead])
async def get_run_pages(run_id: str, db: AsyncSession = Depends(get_db)):
    return await page_service.get_pages_for_run(db, run_id)

@router.get("/{run_id}/actions", response_model=List[ActionRead])
async def get_run_actions(run_id: str, db: AsyncSession = Depends(get_db)):
    return await action_service.get_actions_for_run(db, run_id)

@router.get("/{run_id}/failures", response_model=List[FailureRead])
async def get_run_failures(run_id: str, db: AsyncSession = Depends(get_db)):
    return await failure_service.get_failures_for_run(db, run_id)
from app.schemas.state import StateRead
from app.services import state_service

@router.get("/{run_id}/states", response_model=List[StateRead])
async def get_run_states(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await test_run_service.get_test_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return await state_service.get_states_by_run(db, run_id)
