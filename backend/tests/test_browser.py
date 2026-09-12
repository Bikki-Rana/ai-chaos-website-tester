"""Tests for the browser automation engine (Phase 1).

Run with:
    cd backend
    pytest tests/test_browser.py -v
"""
import asyncio
import json
import sys
from pathlib import Path

import pytest

# Add backend to path
_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.browser.models import PageInfo, ElementInfo
from app.browser.page_extractor import extract_page_info


DEMO_URL = "http://localhost:5000"


@pytest.mark.asyncio
async def test_extract_page_info_returns_page_info():
    """extract_page_info should return a PageInfo instance."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert isinstance(info, PageInfo)


@pytest.mark.asyncio
async def test_run_id_is_assigned():
    """run_id should be set after extraction."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.run_id
    assert len(info.run_id) > 0


@pytest.mark.asyncio
async def test_title_extracted():
    """Page title should be non-empty for demo site."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.title, "Title should not be empty"
    assert "Home" in info.title or "Test Target" in info.title


@pytest.mark.asyncio
async def test_url_captured():
    """final_url should match demo URL."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.final_url.startswith("http://localhost:5000") or info.final_url.startswith("http://127.0.0.1:5000")


@pytest.mark.asyncio
async def test_links_extracted():
    """Demo site has navigation links."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert isinstance(info.links, list)
    assert len(info.links) >= 1
    assert all(isinstance(lnk, ElementInfo) for lnk in info.links)


@pytest.mark.asyncio
async def test_screenshot_saved():
    """A screenshot file should be created after extraction."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.screenshot_path is not None, "screenshot_path should be set"
    assert Path(info.screenshot_path).exists(), f"Screenshot file not found: {info.screenshot_path}"
    assert Path(info.screenshot_path).stat().st_size > 0, "Screenshot file is empty"


@pytest.mark.asyncio
async def test_action_log_saved():
    """A JSON action log should be created after extraction."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.action_log_path is not None
    log_path = Path(info.action_log_path)
    assert log_path.exists(), f"Action log not found: {info.action_log_path}"
    with open(log_path, encoding="utf-8") as f:
        data = json.load(f)
    assert data["run_id"] == info.run_id
    assert "summary" in data
    assert "buttons" in data
    assert "links" in data


@pytest.mark.asyncio
async def test_network_events_captured():
    """At least one network event should be captured."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert isinstance(info.network_events, list)
    assert len(info.network_events) >= 1


@pytest.mark.asyncio
async def test_duration_positive():
    """Extraction should take a measurable amount of time."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.duration_ms > 0


@pytest.mark.asyncio
async def test_timestamp_set():
    """Timestamp should be an ISO 8601 string."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    assert info.timestamp
    assert "T" in info.timestamp


@pytest.mark.asyncio
async def test_demo_site_products_page():
    """Products page should extract buttons and forms."""
    info = await extract_page_info(url=f"{DEMO_URL}/products", headless=True, timeout_ms=20000)
    assert len(info.buttons) >= 3, f"Expected at least 3 add to cart buttons, found {len(info.buttons)}"
    assert len(info.forms) >= 3, f"Expected at least 3 forms, found {len(info.forms)}"


@pytest.mark.asyncio
async def test_demo_site_no_fatal_errors():
    """Demo site extraction should not encounter fatal browser errors."""
    info = await extract_page_info(url=DEMO_URL, headless=True, timeout_ms=20000)
    fatal_errors = [e for e in info.errors if "Navigation error" in e]
    assert not fatal_errors, f"Fatal navigation errors: {fatal_errors}"
