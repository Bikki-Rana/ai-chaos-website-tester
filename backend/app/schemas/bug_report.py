"""Bug report schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class BugReportRead(BaseModel):
    id: str
    failure_id: str
    title: str
    description: str
    steps_to_reproduce: Optional[str]
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)