"""Project service."""
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate

_EDITABLE = ("name", "description", "testing_objective", "pinned")


async def create_project(
    session: AsyncSession, project_in: ProjectCreate, user_id: Optional[str] = None
) -> Project:
    project = Project(
        user_id=user_id,
        name=project_in.name,
        url=str(project_in.url),
        description=project_in.description,
        testing_objective=project_in.testing_objective,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def get_projects(session: AsyncSession) -> List[Project]:
    """All projects regardless of owner. Internal use only, not exposed by the API."""
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())


async def get_projects_for_user(session: AsyncSession, user_id: str) -> List[Project]:
    """Pinned projects first, then the user's own order, then newest first."""
    result = await session.execute(
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.pinned.desc(), Project.sort_order.asc(), Project.created_at.desc())
    )
    return list(result.scalars().all())


async def get_project(session: AsyncSession, project_id: str) -> Optional[Project]:
    return await session.get(Project, project_id)


async def update_project(session: AsyncSession, project: Project, changes: Dict[str, Any]) -> Project:
    for key in _EDITABLE:
        if key in changes:
            setattr(project, key, changes[key])
    await session.commit()
    await session.refresh(project)
    return project


async def reorder_projects(session: AsyncSession, user_id: str, ids: List[str]) -> None:
    if not ids:
        return
    result = await session.execute(
        select(Project).where(Project.user_id == user_id, Project.id.in_(ids))
    )
    by_id = {p.id: p for p in result.scalars().all()}
    for index, project_id in enumerate(ids):
        project = by_id.get(project_id)
        if project is not None:
            project.sort_order = index
    await session.commit()


async def delete_project(session: AsyncSession, project_id: str) -> bool:
    project = await session.get(Project, project_id)
    if not project:
        return False
    await session.delete(project)
    await session.commit()
    return True