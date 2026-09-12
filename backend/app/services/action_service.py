"""Action service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.action import Action
from typing import List

async def get_actions_for_run(session: AsyncSession, run_id: str) -> List[Action]:
    result = await session.execute(
        select(Action).where(Action.test_run_id == run_id).order_by(Action.created_at)
    )
    return list(result.scalars().all())