from app.agent.action_generator import generate_actions
from app.browser.models import PageInfo, ElementInfo

def test_generate_actions():
    page_info = PageInfo(
        url="http://localhost",
        title="Test",
        buttons=[ElementInfo(tag="button", selector="button#submit", text="Submit")],
        links=[ElementInfo(tag="a", selector="a#nav", href="http://localhost/nav")],
        inputs=[
            ElementInfo(tag="input", selector="input#email", attributes={"type": "email"}),
            ElementInfo(tag="input", selector="input#pass", attributes={"type": "password"}),
            ElementInfo(tag="input", selector="input#other", attributes={"type": "text"})
        ],
        forms=[],
        console_messages=[],
        network_events=[]
    )
    
    actions = generate_actions(page_info)
    
    assert len(actions) == 5
    
    btn_action = next(a for a in actions if a["target_selector"] == "button#submit")
    assert btn_action["action_type"] == "click"
    
    link_action = next(a for a in actions if a["target_selector"] == "a#nav")
    assert link_action["action_type"] == "navigate"
    
    email_action = next(a for a in actions if a["target_selector"] == "input#email")
    assert email_action["action_type"] == "fill"
    assert email_action["value"] == "chaos@test.local"
    
    pass_action = next(a for a in actions if a["target_selector"] == "input#pass")
    assert pass_action["action_type"] == "fill"
    assert pass_action["value"] == "ChaosPass123!"
    
    other_action = next(a for a in actions if a["target_selector"] == "input#other")
    assert other_action["action_type"] == "fill"
    assert other_action["value"] == "chaos_test_123"