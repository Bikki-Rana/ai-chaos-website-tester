import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, TYPE_CHECKING, Optional
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.test_run import TestRun
    from app.models.action import Action
    from app.models.state import State
    from app.models.failure import Failure

class Page(Base):
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    test_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    
    url: Mapped[str] = mapped_column(Text, nullable=False)
    final_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    load_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    screenshot_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    depth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="pages")
    test_run: Mapped["TestRun"] = relationship(back_populates="pages")
    actions: Mapped[List["Action"]] = relationship(back_populates="page", cascade="all, delete-orphan")
    states: Mapped[List["State"]] = relationship(back_populates="page", cascade="all, delete-orphan")
    failures: Mapped[List["Failure"]] = relationship(back_populates="page", cascade="all, delete-orphan")