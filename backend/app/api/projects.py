"""Projects API router."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.test_run import TestRunCreate, TestRunRead
from app.services import project_service, test_run_service

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    return await project_service.create_project(db, project)

@router.get("/", response_model=List[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_db)):
    return await project_service.get_projects(db)

@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    success = await project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")

@router.post("/{project_id}/runs", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
async def create_run(project_id: str, db: AsyncSession = Depends(get_db)):
    run = await test_run_service.create_test_run(db, project_id)
    if not run:
        raise HTTPException(status_code=404, detail="Project not found")
    return run

@router.get("/{project_id}/runs", response_model=List[TestRunRead])
async def list_runs(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await test_run_service.get_test_runs(db, project_id)