"""Playwright-based page extraction engine.

Accepts a URL, opens Chromium, loads the page, and extracts:
- Page metadata (URL, title)
- Interactive elements (buttons, links, inputs, forms, selects, textareas)
- Console messages
- Network request/response events
- Screenshot

All results are returned as a PageInfo dataclass.
"""
import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from playwright.async_api import (
    async_playwright,
    Page,
    ConsoleMessage as PlaywrightConsole,
    Request,
    Response,
    BrowserContext,
)

from app.browser.models import (
    ConsoleMessage,
    ElementInfo,
    FormInfo,
    NetworkEvent,
    PageInfo,
)
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Directories for artifacts ─────────────────────────────────────────────────
# Resolve relative to project root so it works both natively and in Docker
_PROJ_ROOT = Path(__file__).resolve().parents[3]  # root of repo
_SCREENSHOTS_DIR = _PROJ_ROOT / "screenshots"
_EVIDENCE_DIR = _PROJ_ROOT / "evidence"


def _ensure_dirs(run_id: str) -> tuple[Path, Path]:
    """Create per-run output directories and return (screenshot_dir, evidence_dir)."""
    ss_dir = _SCREENSHOTS_DIR / run_id
    ev_dir = _EVIDENCE_DIR / run_id
    ss_dir.mkdir(parents=True, exist_ok=True)
    ev_dir.mkdir(parents=True, exist_ok=True)
    return ss_dir, ev_dir


async def _extract_elements(page: Page) -> dict:
    """Extract all interactive elements from the page using Playwright evaluation."""
    return await page.evaluate("""
    () => {
        function getSelector(el) {
            if (el.id) return '#' + el.id;
            if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
            const parts = [];
            let node = el;
            while (node && node.nodeType === 1 && node.tagName !== 'HTML') {
                let part = node.tagName.toLowerCase();
                const siblings = node.parentNode
                    ? Array.from(node.parentNode.children).filter(c => c.tagName === node.tagName)
                    : [];
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(node) + 1;
                    part += ':nth-of-type(' + idx + ')';
                }
                parts.unshift(part);
                node = node.parentNode;
            }
            return parts.join(' > ').substring(0, 200);
        }

        function isVisible(el) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0'
            );
        }

        const buttons = Array.from(document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]'
        )).map(el => ({
            tag: el.tagName.toLowerCase(),
            selector: getSelector(el),
            text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().substring(0, 200),
            element_type: el.type || null,
            name: el.name || null,
            value: el.value || null,
            is_visible: isVisible(el),
            aria_label: el.getAttribute('aria-label') || null,
        }));

        const links = Array.from(document.querySelectorAll('a[href]')).map(el => ({
            tag: 'a',
            selector: getSelector(el),
            text: (el.innerText || '').trim().substring(0, 200),
            href: el.href || null,
            is_visible: isVisible(el),
            aria_label: el.getAttribute('aria-label') || null,
        }));

        const inputs = Array.from(document.querySelectorAll(
            'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="hidden"])'
        )).map(el => ({
            tag: 'input',
            selector: getSelector(el),
            text: '',
            element_type: el.type || 'text',
            name: el.name || null,
            placeholder: el.placeholder || null,
            value: el.value || null,
            is_visible: isVisible(el),
            aria_label: el.getAttribute('aria-label') || null,
        }));

        const selects = Array.from(document.querySelectorAll('select')).map(el => ({
            tag: 'select',
            selector: getSelector(el),
            text: '',
            name: el.name || null,
            value: el.value || null,
            is_visible: isVisible(el),
        }));

        const textareas = Array.from(document.querySelectorAll('textarea')).map(el => ({
            tag: 'textarea',
            selector: getSelector(el),
            text: (el.value || '').trim().substring(0, 200),
            name: el.name || null,
            placeholder: el.placeholder || null,
            is_visible: isVisible(el),
        }));

        const forms = Array.from(document.querySelectorAll('form')).map(form => {
            const fields = Array.from(form.querySelectorAll('input, select, textarea'))
                .filter(el => el.type !== 'hidden')
                .map(el => ({
                    tag: el.tagName.toLowerCase(),
                    selector: getSelector(el),
                    name: el.name || null,
                    element_type: el.type || null,
                    placeholder: el.placeholder || null,
                }));
            const submitBtn = form.querySelector(
                'button[type="submit"], input[type="submit"], button:not([type])'
            );
            return {
                selector: getSelector(form),
                action: form.action || null,
                method: form.method || 'get',
                fields: fields,
                submit_button: submitBtn ? {
                    tag: submitBtn.tagName.toLowerCase(),
                    selector: getSelector(submitBtn),
                    text: (submitBtn.innerText || submitBtn.value || '').trim(),
                } : null,
            };
        });

        return { buttons, links, inputs, selects, textareas, forms };
    }
    """)


def _make_element(data: dict) -> ElementInfo:
    return ElementInfo(
        tag=data.get("tag", ""),
        selector=data.get("selector", ""),
        text=data.get("text", ""),
        element_type=data.get("element_type"),
        href=data.get("href"),
        name=data.get("name"),
        placeholder=data.get("placeholder"),
        value=data.get("value"),
        is_visible=data.get("is_visible", True),
        aria_label=data.get("aria_label"),
    )


async def extract_page_info(
    url: str,
    headless: bool = True,
    timeout_ms: int = 30000,
    run_id: Optional[str] = None,
) -> PageInfo:
    """Open a Chromium browser, navigate to url, extract all page information.

    Args:
        url: The target URL to inspect.
        headless: If False, Chromium opens visibly (useful for local Windows development).
        timeout_ms: Maximum milliseconds to wait for page load.
        run_id: Optional run identifier; generated if not provided.

    Returns:
        PageInfo dataclass populated with all extracted data.
    """
    if run_id is None:
        run_id = str(uuid.uuid4())[:8]

    timestamp = datetime.now(timezone.utc).isoformat()
    ss_dir, ev_dir = _ensure_dirs(run_id)

    console_messages: list[ConsoleMessage] = []
    network_events: list[NetworkEvent] = []
    errors: list[str] = []
    request_times: dict[str, float] = {}

    logger.info("starting_extraction", url=url, run_id=run_id, headless=headless)
    start_time = time.perf_counter()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context: BrowserContext = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36 "
                "ChaosBot/0.1"
            ),
        )

        page: Page = await context.new_page()

        # ── Console listener ──────────────────────────────────────────────────
        def on_console(msg: PlaywrightConsole):
            console_messages.append(
                ConsoleMessage(
                    level=msg.type,
                    text=msg.text[:500],
                    timestamp_ms=time.perf_counter() * 1000,
                    location=str(msg.location) if msg.location else None,
                )
            )

        page.on("console", on_console)

        # ── Network listeners ─────────────────────────────────────────────────
        def on_request(req: Request):
            request_times[req.url] = time.perf_counter()
            network_events.append(
                NetworkEvent(
                    url=req.url[:500],
                    method=req.method,
                    resource_type=req.resource_type,
                    is_request=True,
                    request_headers=dict(req.headers),
                )
            )

        def on_response(resp: Response):
            start = request_times.get(resp.url, 0)
            duration = (time.perf_counter() - start) * 1000 if start else None
            network_events.append(
                NetworkEvent(
                    url=resp.url[:500],
                    method=resp.request.method,
                    resource_type=resp.request.resource_type,
                    status=resp.status,
                    is_request=False,
                    response_headers=dict(resp.headers),
                    duration_ms=duration,
                )
            )

        def on_request_failed(req: Request):
            network_events.append(
                NetworkEvent(
                    url=req.url[:500],
                    method=req.method,
                    resource_type=req.resource_type,
                    is_request=False,
                    failed=True,
                    failure_reason=req.failure or "unknown",
                )
            )

        page.on("request", on_request)
        page.on("response", on_response)
        page.on("requestfailed", on_request_failed)

        # ── Navigate ──────────────────────────────────────────────────────────
        try:
            await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)
        except Exception as exc:
            errors.append(f"Navigation error: {exc}")
            logger.error("navigation_error", url=url, error=str(exc))

        final_url = page.url
        title = await page.title()

        # ── Extract elements ──────────────────────────────────────────────────
        raw = {}
        try:
            raw = await _extract_elements(page)
        except Exception as exc:
            errors.append(f"Element extraction error: {exc}")
            logger.error("extraction_error", error=str(exc))

        buttons = [_make_element(d) for d in raw.get("buttons", [])]
        links = [_make_element(d) for d in raw.get("links", [])]
        inputs = [_make_element(d) for d in raw.get("inputs", [])]
        selects = [_make_element(d) for d in raw.get("selects", [])]
        textareas = [_make_element(d) for d in raw.get("textareas", [])]

        forms = []
        for f in raw.get("forms", []):
            form_fields = [_make_element(field) for field in f.get("fields", [])]
            sub = f.get("submit_button")
            forms.append(
                FormInfo(
                    selector=f.get("selector", ""),
                    action=f.get("action"),
                    method=f.get("method", "get"),
                    fields=form_fields,
                    submit_button=_make_element(sub) if sub else None,
                )
            )

        # ── Screenshot ────────────────────────────────────────────────────────
        screenshot_path: Optional[str] = None
        try:
            ss_path = ss_dir / "page.png"
            await page.screenshot(path=str(ss_path), full_page=True)
            screenshot_path = str(ss_path)
            logger.info("screenshot_saved", path=screenshot_path)
        except Exception as exc:
            errors.append(f"Screenshot error: {exc}")
            logger.error("screenshot_error", error=str(exc))

        await browser.close()

    duration_ms = (time.perf_counter() - start_time) * 1000

    page_info = PageInfo(
        run_id=run_id,
        url=url,
        final_url=final_url,
        title=title,
        buttons=buttons,
        links=links,
        inputs=inputs,
        forms=forms,
        selects=selects,
        textareas=textareas,
        console_messages=console_messages,
        network_events=network_events,
        screenshot_path=screenshot_path,
        duration_ms=round(duration_ms, 2),
        timestamp=timestamp,
        errors=errors,
    )

    action_log_path = _save_action_log(page_info, ev_dir)
    page_info.action_log_path = action_log_path

    logger.info(
        "extraction_complete",
        run_id=run_id,
        url=final_url,
        title=title,
        buttons=len(buttons),
        links=len(links),
        inputs=len(inputs),
        forms=len(forms),
        console_messages=len(console_messages),
        network_events=len(network_events),
        duration_ms=round(duration_ms, 2),
    )

    return page_info


def _save_action_log(info: PageInfo, ev_dir: Path) -> str:
    """Serialise PageInfo to a JSON evidence file and return the path."""
    log_path = ev_dir / "action_log.json"

    data = {
        "run_id": info.run_id,
        "url": info.url,
        "final_url": info.final_url,
        "title": info.title,
        "timestamp": info.timestamp,
        "duration_ms": info.duration_ms,
        "errors": info.errors,
        "summary": {
            "buttons": len(info.buttons),
            "links": len(info.links),
            "inputs": len(info.inputs),
            "forms": len(info.forms),
            "selects": len(info.selects),
            "textareas": len(info.textareas),
            "console_messages": len(info.console_messages),
            "network_events": len(info.network_events),
        },
        "buttons": [b.__dict__ for b in info.buttons],
        "links": [lnk.__dict__ for lnk in info.links],
        "inputs": [i.__dict__ for i in info.inputs],
        "selects": [s.__dict__ for s in info.selects],
        "textareas": [t.__dict__ for t in info.textareas],
        "forms": [
            {
                "selector": f.selector,
                "action": f.action,
                "method": f.method,
                "fields": [fld.__dict__ for fld in f.fields],
                "submit_button": f.submit_button.__dict__ if f.submit_button else None,
            }
            for f in info.forms
        ],
        "console_messages": [c.__dict__ for c in info.console_messages],
        "network_events": [
            {
                "url": n.url,
                "method": n.method,
                "resource_type": n.resource_type,
                "status": n.status,
                "is_request": n.is_request,
                "duration_ms": n.duration_ms,
                "failed": n.failed,
                "failure_reason": n.failure_reason,
            }
            for n in info.network_events
        ],
        "screenshot_path": info.screenshot_path,
    }

    with open(log_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, default=str)

    logger.info("action_log_saved", path=str(log_path))
    return str(log_path)
