"""Failure schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.evidence import EvidenceRead

class FailureRead(BaseModel):
    id: str
    test_run_id: str
    page_id: Optional[str]
    failure_type: str
    message: str
    stack_trace: Optional[str]
    severity: str
    created_at: datetime
    evidence: List[EvidenceRead] = []
    
    model_config = ConfigDict(from_attributes=True)