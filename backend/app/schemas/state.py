"""State schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class StateRead(BaseModel):
    id: str
    test_run_id: str
    page_id: Optional[str]
    dom_hash: Optional[str]
    state_data: Optional[Dict[str, Any]]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)