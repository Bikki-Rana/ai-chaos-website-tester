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

    failure_type: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Phase 11: Classification & Deduplication
    fingerprint_hash: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    occurrence_count: Mapped[int] = mapped_column(String(10), nullable=False, default="1")
    root_cause_hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    test_run: Mapped["TestRun"] = relationship("TestRun", back_populates="failures")
    page: Mapped["Page"] = relationship("Page")
    evidence: Mapped[List["Evidence"]] = relationship("Evidence", back_populates="failure", cascade="all, delete-orphan")