"""Failure ORM model."""
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Failure(Base):
    __tablename__ = "failures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    page_id: Mapped[Optional[str]] = mapped_column(ForeignKey("pages.id", ondelete="SET NULL"), nullable=True)
    
    failure_type: Mapped[str] = mapped_column(String(100), nullable=False) # js_error, network_error, layout_shift
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    test_run: Mapped["TestRun"] = relationship("TestRun", back_populates="failures")
    page: Mapped["Page"] = relationship("Page") # One-way for now is fine, or back_populates if needed
    evidence: Mapped[List["Evidence"]] = relationship("Evidence", back_populates="failure", cascade="all, delete-orphan")