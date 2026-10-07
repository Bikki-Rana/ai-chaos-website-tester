from app.state.state_manager import compute_state_signature
from app.browser.models import PageInfo, ElementInfo

def test_compute_state_signature_determinism():
    p1 = PageInfo(
        run_id="test",
        final_url="http://localhost",
        url="http://localhost",
        title="Test",
        buttons=[
            ElementInfo(tag="button", selector="button#a", text="A"),
            ElementInfo(tag="button", selector="button#b", text="B")
        ],
        links=[],
        inputs=[],
        forms=[],
        console_messages=[],
        network_events=[]
    )
    
    p2 = PageInfo(
        run_id="test",
        final_url="http://localhost",
        url="http://localhost",
        title="Test",
        buttons=[
            ElementInfo(tag="button", selector="button#b", text="B"),
            ElementInfo(tag="button", selector="button#a", text="A")
        ],
        links=[],
        inputs=[],
        forms=[],
        console_messages=[],
        network_events=[]
    )
    
    hash1, data1 = compute_state_signature(p1)
    hash2, data2 = compute_state_signature(p2)
    
    assert hash1 == hash2
    assert data1["element_count"] == 2
    assert data1["selectors"] == ["btn:button#a", "btn:button#b"]