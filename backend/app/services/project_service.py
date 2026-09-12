"""Project service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.project import Project
from app.schemas.project import ProjectCreate
from typing import List, Optional

async def create_project(session: AsyncSession, project_in: ProjectCreate) -> Project:
    project = Project(
        name=project_in.name,
        url=str(project_in.url),
        description=project_in.description,
        testing_objective=project_in.testing_objective
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project

async def get_projects(session: AsyncSession) -> List[Project]:
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())

async def get_project(session: AsyncSession, project_id: str) -> Optional[Project]:
    return await session.get(Project, project_id)

async def delete_project(session: AsyncSession, project_id: str) -> bool:
    project = await session.get(Project, project_id)
    if not project:
        return False
    await session.delete(project)
    await session.commit()
    return True