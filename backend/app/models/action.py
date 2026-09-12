"""Action ORM model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, func, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Action(Base):
    __tablename__ = "actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    page_id: Mapped[Optional[str]] = mapped_column(ForeignKey("pages.id", ondelete="SET NULL"), nullable=True)
    
    action_type: Mapped[str] = mapped_column(String(50), nullable=False) # click, type, navigate, etc.
    target_selector: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success") # success, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    test_run: Mapped["TestRun"] = relationship("TestRun", back_populates="actions")
    page: Mapped["Page"] = relationship("Page", back_populates="actions")