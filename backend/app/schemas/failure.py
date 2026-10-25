"""Failure schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.evidence import EvidenceRead

class FailureRead(BaseModel):
    id: str
    test_run_id: str
    page_id: Optional[str] = None
    failure_type: str
    message: str
    stack_trace: Optional[str] = None
    severity: str
    # Phase 11 classification fields
    fingerprint_hash: Optional[str] = None
    category: Optional[str] = None
    occurrence_count: int = 1
    root_cause_hint: Optional[str] = None
    created_at: datetime
    evidence: List[EvidenceRead] = []

    model_config = ConfigDict(from_attributes=True)

class FailureSummary(BaseModel):
    """Deduplicated failure group for dashboard display."""
    fingerprint_hash: str
    failure_type: str
    category: str
    severity: str
    message: str
    root_cause_hint: Optional[str] = None
    occurrence_count: int
    first_seen: datetime
    last_seen: datetime
    failure_ids: List[str]

    model_config = ConfigDict(from_attributes=True)