from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.test_run import RunStatus

class TestRunBase(BaseModel):
    project_id: str

class TestRunCreate(TestRunBase):
    pass

class TestRunRead(TestRunBase):
    id: str
    status: RunStatus
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration_ms: Optional[float]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class RunStartOptions(BaseModel):
    max_pages: int = 10
    max_depth: int = 2