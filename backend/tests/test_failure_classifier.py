"""Tests for Failure Classifier (Phase 11)."""
import pytest
from app.agent.failure_classifier import (
    classify,
    fingerprint,
    normalise_message,
    root_cause_hint,
    severity_score,
    enrich,
)


def test_normalise_message_strips_uuids():
    msg1 = "Resource 4f7c81a2-1111-2222-3333-abcdef123456 not found"
    msg2 = "Resource 9a8b7c6d-9999-8888-7777-123456abcdef not found"
    assert normalise_message(msg1) == normalise_message(msg2)


def test_normalise_message_strips_timestamps():
    msg1 = "Timeout at 2026-10-25T22:50:00Z on page"
    msg2 = "Timeout at 2026-10-25T23:10:45.123Z on page"
    assert normalise_message(msg1) == normalise_message(msg2)


def test_fingerprint_deterministic():
    fp1 = fingerprint("js_error", "TypeError: Cannot read properties of undefined")
    fp2 = fingerprint("js_error", "TypeError: Cannot read properties of undefined")
    assert fp1 == fp2
    assert len(fp1) == 12


def test_fingerprint_groups_similar_errors_with_different_uuids():
    msg1 = "Order 4f7c81a2-1111-2222-3333-abcdef123456 failed"
    msg2 = "Order 9a8b7c6d-9999-8888-7777-123456abcdef failed"
    assert fingerprint("http_error", msg1) == fingerprint("http_error", msg2)


def test_classify_categories():
    assert classify("js_error", "TypeError: foo is not a function") == "UNCAUGHT_JS_EXCEPTION"
    assert classify("http_error", "HTTP 500 Internal Server Error") == "SERVER_5XX"
    assert classify("http_error", "HTTP 404 Not Found on /logo.png") == "DEAD_ASSET_OR_LINK"
    assert classify("http_error", "HTTP 403 Forbidden") == "AUTH_OR_SECURITY"
    assert classify("navigation_error", "Page crashed") == "NAVIGATION_TIMEOUT"
    assert classify("network_failure", "net::ERR_FAILED") == "RESOURCE_FAILURE"


def test_severity_scoring():
    # 500 should be critical
    assert severity_score("http_error", "HTTP 500 Internal Server Error", "medium") == "critical"
    # 404 is medium
    assert severity_score("http_error", "HTTP 404 Not Found", "medium") == "medium"
    # JS TypeError is high
    assert severity_score("js_error", "TypeError: undefined is not a function", "medium") == "high"


def test_root_cause_hint():
    hint = root_cause_hint("js_error", "ReferenceError: applyPromoCode is not defined", "UNCAUGHT_JS_EXCEPTION")
    assert "ReferenceError" in hint
    assert "applyPromoCode" in hint

    hint_500 = root_cause_hint("http_error", "HTTP 500 on POST /checkout", "SERVER_5XX")
    assert "unhandled exception" in hint_500


def test_enrich():
    raw = {
        "failure_type": "js_error",
        "message": "TypeError: Cannot read properties of null (reading 'value')",
        "stack_trace": "at app.js:14:2",
        "severity": "medium",
    }
    enriched = enrich(raw)
    assert enriched["category"] == "UNCAUGHT_JS_EXCEPTION"
    assert enriched["severity"] == "high"
    assert "fingerprint_hash" in enriched
    assert len(enriched["fingerprint_hash"]) == 12
    assert "root_cause_hint" in enriched
    assert "TypeError" in enriched["root_cause_hint"]