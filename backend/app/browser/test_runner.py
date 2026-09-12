"""CLI test runner for the browser automation engine.

Usage:
    python -m app.browser.test_runner --url http://localhost:5000
    python -m app.browser.test_runner --url http://localhost:5000 --headed

Outputs:
    - Structured console report
    - Screenshot at screenshots/<run_id>/page.png
    - JSON action log at evidence/<run_id>/action_log.json
"""
import argparse
import asyncio
import io
import sys
from pathlib import Path

# Force UTF-8 encoding on standard output/error if on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.browser.page_extractor import extract_page_info
from app.core.logging import configure_logging


def _print_section(title: str) -> None:
    width = 60
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)


def _print_elements(label: str, elements: list) -> None:
    print(f"\n  [{label}] - {len(elements)} found")
    for el in elements[:10]:
        text = getattr(el, 'text', '') or getattr(el, 'href', '') or ''
        extra = ""
        if hasattr(el, 'element_type') and el.element_type:
            extra = f" [{el.element_type}]"
        if hasattr(el, 'href') and el.href:
            extra += f" -> {el.href[:60]}"
        print(f"    * {el.tag}{extra}: {text[:60]}")
    if len(elements) > 10:
        print(f"    ... and {len(elements) - 10} more")


async def _run(url: str, headed: bool, timeout_ms: int) -> int:
    """Run the extraction and print a structured report. Returns exit code."""
    print("\n" + "+------------------------------------------------------------+")
    print("  AI Website Chaos Tester - Phase 1 Browser Prototype         ")
    print("+------------------------------------------------------------+")
    print(f"  Target URL : {url}")
    print(f"  Mode       : {'headed (visible Chromium)' if headed else 'headless'}")
    print(f"  Timeout    : {timeout_ms} ms")

    try:
        info = await extract_page_info(
            url=url,
            headless=not headed,
            timeout_ms=timeout_ms,
        )
    except Exception as exc:
        print(f"\n[FATAL] Extraction failed: {exc}")
        return 1

    _print_section("PAGE INFO")
    print(f"  Run ID     : {info.run_id}")
    print(f"  URL        : {info.final_url}")
    print(f"  Title      : {info.title}")
    print(f"  Duration   : {info.duration_ms:.0f} ms")
    print(f"  Timestamp  : {info.timestamp}")

    _print_section("ELEMENTS DISCOVERED")
    _print_elements("Buttons", info.buttons)
    _print_elements("Links", info.links)
    _print_elements("Inputs", info.inputs)
    _print_elements("Selects", info.selects)
    _print_elements("Textareas", info.textareas)

    _print_section("FORMS")
    print(f"  {len(info.forms)} form(s) found")
    for i, form in enumerate(info.forms, 1):
        method = (form.method or 'get').upper()
        print(f"  Form {i}: {method} {form.action or '(no action)'} - {len(form.fields)} field(s)")

    _print_section("CONSOLE MESSAGES")
    print(f"  {len(info.console_messages)} message(s) captured")
    for msg in info.console_messages[:10]:
        print(f"  [{msg.level.upper()}] {msg.text[:100]}")
    if len(info.console_messages) > 10:
        print(f"  ... and {len(info.console_messages) - 10} more")

    _print_section("NETWORK EVENTS")
    responses = [n for n in info.network_events if not n.is_request]
    requests = [n for n in info.network_events if n.is_request]
    failed = [n for n in info.network_events if n.failed]
    print(f"  Requests : {len(requests)}")
    print(f"  Responses: {len(responses)}")
    print(f"  Failed   : {len(failed)}")
    if failed:
        for ev in failed:
            print(f"  [FAIL] {ev.url[:80]} - {ev.failure_reason}")
    non_200 = [n for n in responses if n.status and n.status >= 400]
    if non_200:
        print(f"  HTTP errors:")
        for ev in non_200:
            print(f"    [{ev.status}] {ev.url[:80]}")

    _print_section("ARTIFACTS")
    if info.screenshot_path:
        print(f"  Screenshot : {info.screenshot_path}")
    else:
        print("  Screenshot : NOT SAVED (error occurred)")
    if info.action_log_path:
        print(f"  Action Log : {info.action_log_path}")
    else:
        print("  Action Log : NOT SAVED (error occurred)")

    if info.errors:
        _print_section("ERRORS")
        for err in info.errors:
            print(f"  [ERROR] {err}")

    _print_section("SUMMARY")
    print(f"  Buttons    : {len(info.buttons)}")
    print(f"  Links      : {len(info.links)}")
    print(f"  Inputs     : {len(info.inputs)}")
    print(f"  Forms      : {len(info.forms)}")
    print(f"  Selects    : {len(info.selects)}")
    print(f"  Textareas  : {len(info.textareas)}")
    print(f"  Console    : {len(info.console_messages)}")
    print(f"  Network    : {len(info.network_events)}")
    print("\n  [SUCCESS] Phase 1 milestone: Playwright extraction complete.")
    print()

    return 1 if info.errors else 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(
        description="AI Website Chaos Tester - Browser Automation Prototype (Phase 1)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m app.browser.test_runner --url http://localhost:5000\n"
            "  python -m app.browser.test_runner --url http://localhost:5000 --headed\n"
        ),
    )
    parser.add_argument("--url", required=True, help="Target URL to inspect")
    parser.add_argument(
        "--headed",
        action="store_true",
        default=False,
        help="Open Chromium visibly (useful on Windows for watching automation)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30000,
        help="Page load timeout in milliseconds (default: 30000)",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(_run(args.url, args.headed, args.timeout))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
