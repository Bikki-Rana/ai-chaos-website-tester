"""Page schemas."""
from pydantic import BaseModel, ConfigDict, HttpUrl
from typing import Optional
from datetime import datetime

class PageRead(BaseModel):
    id: str
    project_id: str
    test_run_id: str
    url: str
    final_url: Optional[str] = None
    title: Optional[str] = None
    load_time_ms: Optional[float]
    screenshot_path: Optional[str]
    depth: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)