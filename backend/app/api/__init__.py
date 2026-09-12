"""API router configuration."""
from fastapi import APIRouter
from app.api import projects, runs, failures

api_router = APIRouter()
api_router.include_router(projects.router)
api_router.include_router(runs.router)
api_router.include_router(failures.router)