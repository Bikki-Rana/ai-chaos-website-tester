"""API tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import get_db
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.base import Base

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

@pytest.fixture
def override_get_db(async_session):
    async def _override_get_db():
        yield async_session
    return _override_get_db

@pytest.fixture
def test_app(override_get_db):
    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()

@pytest.fixture
async def async_client(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.mark.asyncio
async def test_create_project_api(async_client):
    response = await async_client.post(
        "/api/v1/projects/",
        json={"name": "API Test Project", "url": "http://localhost:5000"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API Test Project"
    assert data["url"] == "http://localhost:5000/"
    assert "id" in data

@pytest.mark.asyncio
async def test_list_projects_api(async_client):
    # Create one first
    await async_client.post(
        "/api/v1/projects/",
        json={"name": "List Test Project", "url": "http://localhost:5000"}
    )
    
    response = await async_client.get("/api/v1/projects/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "List Test Project"