from app.agent.action_selector import select_next_action

def test_select_next_action_priorities():
    actions = [
        {"id": "1", "action_type": "navigate", "target_selector": "a#home"},
        {"id": "2", "action_type": "click", "target_selector": "button#submit"},
        {"id": "3", "action_type": "fill", "target_selector": "input#email"},
        {"id": "4", "action_type": "check", "target_selector": "input#agree"}
    ]
    
    # Fill should be priority 1
    selected = select_next_action(actions)
    assert selected["id"] == "3"
    
    # Without fill, check should be priority 2
    actions.pop(2)
    selected = select_next_action(actions)
    assert selected["id"] == "4"
    
    # Without check, click should be priority 3
    actions.pop(2)
    selected = select_next_action(actions)
    assert selected["id"] == "2"
    
    # Without click, navigate should be priority 4
    actions.pop(1)
    selected = select_next_action(actions)
    assert selected["id"] == "1"

def test_select_next_action_ignores_completed():
    actions = [
        {"id": "1", "action_type": "fill", "status": "success"},
        {"id": "2", "action_type": "click", "status": "pending"}
    ]
    
    selected = select_next_action(actions)
    assert selected["id"] == "2"