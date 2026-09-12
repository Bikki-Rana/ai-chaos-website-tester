"""TestRun ORM model."""
import uuid
import enum
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, Enum, DateTime, ForeignKey, func, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class RunStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"

class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.PENDING, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_runs")
    pages: Mapped[List["Page"]] = relationship("Page", back_populates="test_run", cascade="all, delete-orphan")
    actions: Mapped[List["Action"]] = relationship("Action", back_populates="test_run", cascade="all, delete-orphan")
    failures: Mapped[List["Failure"]] = relationship("Failure", back_populates="test_run", cascade="all, delete-orphan")