"""Action schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime

class ActionRead(BaseModel):
    id: str
    test_run_id: str
    page_id: Optional[str]
    action_type: str
    target_selector: Optional[str]
    value: Optional[str]
    status: str
    error_message: Optional[str]
    metadata_json: Optional[Any]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)