"""Auth and ownership dependencies shared by all routers."""
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.failure import Failure
from app.models.project import Project
from app.models.test_run import TestRun
from app.models.user import User
from app.services import failure_service, project_service, test_run_service

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise unauthorized
    user = await db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


async def get_owned_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = await project_service.get_project(db, project_id)
    # 404 (not 403) so other users cannot probe which IDs exist.
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def get_owned_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TestRun:
    run = await test_run_service.get_test_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    project = await project_service.get_project(db, run.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


async def get_owned_failure(
    failure_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Failure:
    failure = await failure_service.get_failure_with_evidence(db, failure_id)
    if failure is None:
        raise HTTPException(status_code=404, detail="Failure not found")
    run = await test_run_service.get_test_run(db, failure.test_run_id)
    project = await project_service.get_project(db, run.project_id) if run else None
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Failure not found")
    return failure