"""Database tests."""
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.base import Base
from app.models.project import Project
from app.models.test_run import TestRun, RunStatus
from sqlalchemy import select

# Use an in-memory SQLite database for tests
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
async def async_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def async_session(async_engine):
    Session = async_sessionmaker(async_engine, expire_on_commit=False)
    async with Session() as session:
        yield session

@pytest.mark.asyncio
async def test_create_project(async_session):
    project = Project(
        name="Test Project",
        url="http://localhost:5000",
        description="A test project"
    )
    async_session.add(project)
    await async_session.commit()
    
    result = await async_session.execute(select(Project).where(Project.name == "Test Project"))
    db_project = result.scalar_one_or_none()
    
    assert db_project is not None
    assert db_project.name == "Test Project"
    assert db_project.url == "http://localhost:5000"
    assert db_project.id is not None

@pytest.mark.asyncio
async def test_create_test_run(async_session):
    project = Project(name="Run Test Project", url="http://localhost:5000")
    async_session.add(project)
    await async_session.commit()
    
    run = TestRun(project_id=project.id, status=RunStatus.PENDING)
    async_session.add(run)
    await async_session.commit()
    
    assert run.id is not None
    assert run.project_id == project.id
    assert run.status == RunStatus.PENDING