"""Failure service."""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.failure import Failure


async def get_failures_for_run(
    session: AsyncSession,
    run_id: str,
) -> List[Failure]:
    result = await session.execute(
        select(Failure)
        .options(selectinload(Failure.evidence))
        .where(Failure.test_run_id == run_id)
        .order_by(Failure.created_at)
    )

    return list(result.scalars().all())


async def get_failure_with_evidence(
    session: AsyncSession,
    failure_id: str,
) -> Optional[Failure]:
    result = await session.execute(
        select(Failure)
        .options(selectinload(Failure.evidence))
        .where(Failure.id == failure_id)
    )

    return result.scalar_one_or_none()