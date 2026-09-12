"""SQLAlchemy 2.0 declarative base shared by all ORM models."""
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, mapped_column, MappedColumn
from typing import Annotated


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Reusable column types
TimestampPK = Annotated[
    datetime,
    mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False),
]


class Base(DeclarativeBase):
    """Shared declarative base. All models inherit from this."""
    pass