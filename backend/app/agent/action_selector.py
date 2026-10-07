"""Action Selector - Heuristics for prioritizing which action to execute next."""
import random
from typing import List, Optional, Dict, Any

# Priority mapping (lower number = higher priority)
PRIORITY_MAP = {
    "fill": 1,
    "check": 2,
    "click": 3,
    "navigate": 4
}

def select_next_action(actions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Given a list of pending actions (as dicts), select the best one to execute next.
    Prioritizes filling inputs before clicking buttons or navigating.
    Breaks ties randomly.
    """
    if not actions:
        return None

    # Filter out anything not pending just in case
    pending_actions = [a for a in actions if a.get("status", "pending") == "pending"]
    if not pending_actions:
        return None

    # Group by priority
    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for action in pending_actions:
        act_type = action.get("action_type", "navigate")
        priority = PRIORITY_MAP.get(act_type, 99)
        if priority not in grouped:
            grouped[priority] = []
        grouped[priority].append(action)

    if not grouped:
        return None

    # Get the highest priority group (lowest integer key)
    highest_priority = min(grouped.keys())
    top_candidates = grouped[highest_priority]

    # Break ties randomly to introduce a bit of chaos
    return random.choice(top_candidates)