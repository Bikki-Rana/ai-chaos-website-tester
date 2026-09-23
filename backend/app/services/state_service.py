"""State service."""
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.state import State

async def get_states_by_run(db: AsyncSession, run_id: str) -> List[State]:
    """Get all states for a specific test run."""
    result = await db.execute(
        select(State)
        .where(State.test_run_id == run_id)
        .order_by(State.created_at)
    )
    return list(result.scalars().all())