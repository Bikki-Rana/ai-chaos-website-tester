"""Page service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.page import Page
from typing import List

async def get_pages_for_run(session: AsyncSession, run_id: str) -> List[Page]:
    result = await session.execute(
        select(Page).where(Page.test_run_id == run_id).order_by(Page.created_at)
    )
    return list(result.scalars().all())