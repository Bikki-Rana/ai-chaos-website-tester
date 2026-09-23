"""Action Generator - Heuristics for generating UI interactions."""
from typing import List, Dict, Any
from app.browser.models import PageInfo

def generate_actions(page_info: PageInfo) -> List[Dict[str, Any]]:
    """
    Given a PageInfo, generate a list of actionable interactions using rule-based heuristics.
    """
    actions = []

    # 1. Generate clicks for buttons
    for btn in page_info.buttons:
        if not btn.selector:
            continue
        actions.append({
            "action_type": "click",
            "target_selector": btn.selector,
            "value": btn.text or "Button",
            "status": "pending"
        })

    # 2. Generate navigations/clicks for links
    for link in page_info.links:
        if not link.selector or not link.href:
            continue
        if link.href.startswith("javascript:"):
            action_type = "click"
        else:
            action_type = "navigate"
            
        actions.append({
            "action_type": action_type,
            "target_selector": link.selector,
            "value": link.href,
            "status": "pending"
        })

    # 3. Generate fill actions for inputs
    for inp in page_info.inputs:
        if not inp.selector:
            continue
            
        input_type = (inp.attributes.get("type", "") if inp.attributes else "").lower()
        input_name = (inp.attributes.get("name", "") if inp.attributes else "").lower()
        
        # Heuristics based on type and name
        fill_value = "chaos_test_123"
        if input_type == "email" or "email" in input_name:
            fill_value = "chaos@test.local"
        elif input_type == "password" or "pass" in input_name:
            fill_value = "ChaosPass123!"
        elif input_type == "number":
            fill_value = "42"
        elif input_type in ("checkbox", "radio"):
            # For checkbox/radio, action is 'check' rather than 'fill'
            actions.append({
                "action_type": "check",
                "target_selector": inp.selector,
                "value": "true",
                "status": "pending"
            })
            continue

        actions.append({
            "action_type": "fill",
            "target_selector": inp.selector,
            "value": fill_value,
            "status": "pending"
        })

    return actions