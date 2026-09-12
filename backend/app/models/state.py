"""State ORM model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, func, DateTime, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class State(Base):
    __tablename__ = "states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    page_id: Mapped[Optional[str]] = mapped_column(ForeignKey("pages.id", ondelete="SET NULL"), nullable=True)
    
    dom_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    state_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    test_run: Mapped["TestRun"] = relationship("TestRun")
    page: Mapped["Page"] = relationship("Page")