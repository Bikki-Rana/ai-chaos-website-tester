"""Tests for Bug Report Generator (Phase 12)."""
import pytest
import json
from datetime import datetime, timezone
from app.reports.report_generator import generate_markdown_report, generate_html_report


def sample_report_data():
    now = datetime.now(timezone.utc)
    return {
        "run": {
            "id": "run-test-12345678",
            "status": "COMPLETED",
            "started_at": now.isoformat(),
            "finished_at": now.isoformat(),
            "duration_ms": 12500.0,
            "error_message": None,
        },
        "project": {
            "id": "proj-123",
            "name": "Acme Demo Shop",
            "url": "http://localhost:5000",
            "testing_objective": "Test checkout and promo code application",
        },
        "metrics": {
            "total_pages_visited": 4,
            "unique_states_discovered": 6,
            "total_actions_executed": 15,
            "total_actions_generated": 20,
            "actions_by_type": {"click": 8, "fill": 5, "navigate": 2},
            "total_raw_failures": 3,
            "unique_failures_count": 2,
            "severity_breakdown": {"critical": 1, "high": 1, "medium": 0, "low": 0},
            "category_breakdown": {
                "SERVER_5XX": 1,
                "UNCAUGHT_JS_EXCEPTION": 1,
            },
        },
        "pages": [
            {"url": "http://localhost:5000/", "title": "Home", "depth": 0},
            {"url": "http://localhost:5000/cart", "title": "Cart", "depth": 1},
        ],
        "unique_failures": [
            {
                "fingerprint_hash": "a1b2c3d4e5f6",
                "failure_type": "http_error",
                "category": "SERVER_5XX",
                "severity": "critical",
                "message": "HTTP 500 on POST /logout",
                "root_cause_hint": "The server threw an unhandled exception. Check server logs.",
                "occurrence_count": 2,
                "first_seen": now,
                "last_seen": now,
                "failure_ids": ["f1", "f2"],
            },
            {
                "fingerprint_hash": "b2c3d4e5f6a1",
                "failure_type": "js_error",
                "category": "UNCAUGHT_JS_EXCEPTION",
                "severity": "high",
                "message": "ReferenceError: applyPromoCode is not defined",
                "root_cause_hint": "ReferenceError: A variable or function is used before it is defined.",
                "occurrence_count": 1,
                "first_seen": now,
                "last_seen": now,
                "failure_ids": ["f3"],
            },
        ],
        "raw_failures_count": 3,
    }


def test_markdown_report_structure():
    data = sample_report_data()
    md = generate_markdown_report(data)

    assert "# 🤖 Chaos Test Report — Acme Demo Shop" in md
    assert "run-test-12345678" in md
    assert "http://localhost:5000" in md
    assert "🔴 **Critical:** 1" in md
    assert "🟠 **High:** 1" in md
    assert "Issue #1: HTTP 500 on POST /logout" in md
    assert "ReferenceError: applyPromoCode is not defined" in md
    assert "applyPromoCode is not defined" in md


def test_html_report_structure():
    data = sample_report_data()
    html = generate_html_report(data)

    assert "<!DOCTYPE html>" in html
    assert "Acme Demo Shop" in html
    assert "run-test-12345678" in html
    assert "HTTP 500 on POST /logout" in html
    assert "applyPromoCode is not defined" in html
    assert "sev-critical" in html