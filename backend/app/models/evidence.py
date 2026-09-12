"""Evidence ORM model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    failure_id: Mapped[str] = mapped_column(ForeignKey("failures.id", ondelete="CASCADE"), nullable=False)
    
    evidence_type: Mapped[str] = mapped_column(String(50), nullable=False) # screenshot, network_log, console_log
    file_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    failure: Mapped["Failure"] = relationship("Failure", back_populates="evidence")