"""Evidence schemas."""
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class EvidenceRead(BaseModel):
    id: str
    failure_id: str
    evidence_type: str
    file_path: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)