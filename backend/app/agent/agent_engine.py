"""Agent Engine - Runs the active chaos loop inside a single browser context."""
import time
import structlog
from typing import AsyncGenerator, Tuple
from datetime import datetime, timezone
from playwright.async_api import async_playwright, Page, BrowserContext, ConsoleMessage, Request, Response

from app.browser.models import PageInfo, NetworkEvent, ConsoleMessage as LogConsoleMessage
from app.browser.page_extractor import _ensure_dirs, _extract_elements, _make_element, _save_action_log
from app.browser.action_executor import execute_action

logger = structlog.get_logger(__name__)

async def run_agent_loop(
    start_url: str,
    run_id: str,
    max_actions: int = 10,
    headless: bool = True,
    timeout_ms: int = 30000,
    action_callback=None
) -> AsyncGenerator[PageInfo, None]:
    """
    Main agent loop.
    Yields PageInfo after every action (or initial load).
    action_callback must be an async function that takes a PageInfo and returns a selected Action dict.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    ss_dir, ev_dir = _ensure_dirs(run_id)

    logger.info("starting_agent_loop", url=start_url, run_id=run_id, headless=headless)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )
        context: BrowserContext = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChaosBot/0.1",
        )
        page: Page = await context.new_page()

        # Listeners (cleared and reset per extraction cycle if we wanted, but we'll accumulate them for simplicity, or clear them manually)
        console_messages = []
        network_events = []
        request_times = {}

        def on_console(msg: ConsoleMessage):
            console_messages.append(
                LogConsoleMessage(
                    level=msg.type,
                    text=msg.text[:500],
                    timestamp_ms=time.perf_counter() * 1000,
                    location=str(msg.location) if msg.location else None,
                )
            )

        def on_request(req: Request):
            request_times[req.url] = time.perf_counter()
            network_events.append(
                NetworkEvent(
                    url=req.url[:500], method=req.method, resource_type=req.resource_type, is_request=True
                )
            )

        def on_response(resp: Response):
            start = request_times.get(resp.url, 0)
            duration = (time.perf_counter() - start) * 1000 if start else None
            network_events.append(
                NetworkEvent(
                    url=resp.url[:500], method=resp.request.method, resource_type=resp.request.resource_type,
                    status=resp.status, is_request=False, duration_ms=duration
                )
            )

        def on_request_failed(req: Request):
            network_events.append(
                NetworkEvent(
                    url=req.url[:500], method=req.method, resource_type=req.resource_type,
                    is_request=False, failed=True, failure_reason=req.failure or "unknown"
                )
            )

        page.on("console", on_console)
        page.on("request", on_request)
        page.on("response", on_response)
        page.on("requestfailed", on_request_failed)

        # Initial Navigation
        try:
            await page.goto(start_url, timeout=timeout_ms, wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)
        except Exception as exc:
            logger.error("initial_navigation_error", url=start_url, error=str(exc))
            await browser.close()
            return

        actions_executed = 0

        while actions_executed < max_actions:
            start_time = time.perf_counter()
            errors = []
            
            final_url = page.url
            try:
                title = await page.title()
            except:
                title = ""

            # Extract elements
            raw = {}
            try:
                raw = await _extract_elements(page)
            except Exception as exc:
                errors.append(f"Element extraction error: {exc}")

            buttons = [_make_element(d) for d in raw.get("buttons", [])]
            links = [_make_element(d) for d in raw.get("links", [])]
            inputs = [_make_element(d) for d in raw.get("inputs", [])]
            selects = [_make_element(d) for d in raw.get("selects", [])]
            textareas = [_make_element(d) for d in raw.get("textareas", [])]
            
            from app.browser.models import FormInfo
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

            # Screenshot
            screenshot_path = None
            try:
                ss_path = ss_dir / f"step_{actions_executed}.png"
                await page.screenshot(path=str(ss_path), full_page=True)
                screenshot_path = str(ss_path)
            except Exception as exc:
                errors.append(f"Screenshot error: {exc}")

            duration_ms = (time.perf_counter() - start_time) * 1000

            page_info = PageInfo(
                run_id=run_id,
                url=final_url,
                final_url=final_url,
                title=title,
                buttons=buttons,
                links=links,
                inputs=inputs,
                forms=forms,
                selects=selects,
                textareas=textareas,
                console_messages=console_messages.copy(),
                network_events=network_events.copy(),
                screenshot_path=screenshot_path,
                duration_ms=round(duration_ms, 2),
                timestamp=datetime.now(timezone.utc).isoformat(),
                errors=errors,
            )
            
            # Clear logs for next step
            console_messages.clear()
            network_events.clear()

            page_info.action_log_path = _save_action_log(page_info, ev_dir)

            # Yield PageInfo to DB persistence (and wait for it to return next action)
            yield page_info
            
            if not action_callback:
                break
                
            next_action = await action_callback(page_info)
            if not next_action:
                logger.info("no_actions_available")
                break

            # Execute
            success = await execute_action(page, next_action, timeout_ms=timeout_ms)
            
            # We don't yield the result of execute_action directly, but the next loop iteration 
            # will capture the new state and errors.
            actions_executed += 1

        await browser.close()