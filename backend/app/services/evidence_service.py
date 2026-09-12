"""Evidence service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.evidence import Evidence
from typing import List

async def get_evidence_for_failure(session: AsyncSession, failure_id: str) -> List[Evidence]:
    result = await session.execute(
        select(Evidence).where(Evidence.failure_id == failure_id)
    )
    return list(result.scalars().all())