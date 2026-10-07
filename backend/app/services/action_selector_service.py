"""Service for selecting actions from the database."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.action import Action
from app.agent.action_selector import select_next_action

async def get_next_action_for_run(db: AsyncSession, run_id: str) -> Optional[Action]:
    """
    Fetch all pending actions for a run, apply the selection heuristic, 
    and return the chosen Action model.
    """
    result = await db.execute(
        select(Action)
        .where(Action.test_run_id == run_id)
        .where(Action.status == "pending")
    )
    pending_actions = list(result.scalars().all())
    
    if not pending_actions:
        return None

    # Convert to dicts for the selector logic
    action_dicts = [
        {
            "id": a.id,
            "action_type": a.action_type,
            "target_selector": a.target_selector,
            "value": a.value,
            "status": a.status
        }
        for a in pending_actions
    ]

    selected_dict = select_next_action(action_dicts)
    if not selected_dict:
        return None

    # Find the corresponding ORM model
    for a in pending_actions:
        if a.id == selected_dict["id"]:
            return a
            
    return None