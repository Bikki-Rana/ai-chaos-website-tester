"""Failure Detector - Identifies application failures from PageInfo."""
import structlog
from typing import List, Dict, Any
from app.browser.models import PageInfo

logger = structlog.get_logger(__name__)

def detect_failures(page_info: PageInfo) -> List[Dict[str, Any]]:
    """
    Analyzes PageInfo for failures like JS errors and Network errors.
    Returns a list of dictionaries with failure details.
    """
    failures = []

    # 1. Detect Console Errors (JS errors)
    for msg in page_info.console_messages:
        if msg.level == 'error':
            # Skip some common harmless noise if desired, but for now log all errors
            failures.append({
                "failure_type": "js_error",
                "message": msg.text,
                "stack_trace": msg.location,
                "severity": "high"
            })

    # 2. Detect Network Errors
    for event in page_info.network_events:
        if not event.is_request:
            if event.failed:
                failures.append({
                    "failure_type": "network_failure",
                    "message": f"Network request failed to {event.url}: {event.failure_reason}",
                    "stack_trace": None,
                    "severity": "medium"
                })
            elif event.status and event.status >= 400:
                # 404, 500, etc.
                severity = "high" if event.status >= 500 else "medium"
                failures.append({
                    "failure_type": "http_error",
                    "message": f"HTTP {event.status} on {event.method} {event.url}",
                    "stack_trace": None,
                    "severity": severity
                })

    # 3. Playwright Internal Navigation Errors
    for err in page_info.errors:
        failures.append({
            "failure_type": "navigation_error",
            "message": err,
            "stack_trace": None,
            "severity": "high"
        })

    if failures:
        logger.info("failures_detected", count=len(failures), url=page_info.final_url)
        
    return failures