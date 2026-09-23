"""State Management logic."""
import hashlib
import json
from typing import Tuple, Dict, Any
from app.browser.models import PageInfo

def compute_state_signature(page_info: PageInfo) -> Tuple[str, Dict[str, Any]]:
    """
    Computes a deterministic State Signature (DOM hash) based on the 
    interactive elements present on the page.
    Returns (dom_hash, state_data_json).
    """
    # Collect all interactive selectors
    selectors = []
    
    for btn in page_info.buttons:
        if btn.selector: selectors.append(f"btn:{btn.selector}")
        
    for link in page_info.links:
        if link.selector: selectors.append(f"link:{link.selector}")
        
    for inp in page_info.inputs:
        if inp.selector: selectors.append(f"input:{inp.selector}")
        
    for form in page_info.forms:
        if form.selector: selectors.append(f"form:{form.selector}")

    # Sort to ensure determinism regardless of DOM ordering
    selectors.sort()
    
    # Create the state data dictionary
    state_data = {
        "element_count": len(selectors),
        "selectors": selectors,
        "title_hint": page_info.title
    }
    
    # Compute SHA-256 hash
    hash_input = json.dumps(selectors).encode('utf-8')
    dom_hash = hashlib.sha256(hash_input).hexdigest()
    
    return dom_hash, state_data