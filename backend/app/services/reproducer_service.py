"""Service to generate standalone reproduction scripts for recorded failures."""
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.failure import Failure
from app.models.action import Action
from app.models.test_run import TestRun

async def generate_reproduction_script(db: AsyncSession, failure_id: str) -> str:
    """
    Given a failure_id, fetches the sequence of successful actions leading up
    to that failure and generates a standalone Playwright Python script to replay them.
    """
    # 1. Fetch the failure
    res = await db.execute(select(Failure).where(Failure.id == failure_id))
    failure = res.scalars().first()
    if not failure:
        return ""

    # 2. Fetch all successful actions in that run that occurred BEFORE or AT the failure time
    # Because of our loop, actions are saved before the page load that might cause the failure.
    # We will just order by created_at.
    res_actions = await db.execute(
        select(Action)
        .where(
            Action.test_run_id == failure.test_run_id,
            Action.status == "success",
            Action.created_at <= failure.created_at
        )
        .order_by(Action.created_at.asc())
    )
    actions = res_actions.scalars().all()

    # 3. Build the script
    lines = [
        "\"\"\"",
        f"Auto-generated Failure Reproduction Script",
        f"Failure ID: {failure_id}",
        f"Failure Type: {failure.failure_type}",
        f"Message: {failure.message}",
        "\"\"\"",
        "import asyncio",
        "from playwright.async_api import async_playwright",
        "",
        "async def reproduce_failure():",
        "    print('Starting reproduction script...')",
        "    async with async_playwright() as p:",
        "        browser = await p.chromium.launch(headless=False, slow_mo=500)",
        "        context = await browser.new_context(",
        "            viewport={'width': 1280, 'height': 800},",
        "            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ChaosBot/0.1'",
        "        )",
        "        page = await context.new_page()",
        ""
    ]

    # Assume the first successful action is usually a navigate or we need the base URL
    # Let's see if there's a navigate action. If not, we might need the run's base url.
    has_navigate = any(a.action_type == "navigate" for a in actions)
    if not has_navigate:
        res_run = await db.execute(select(TestRun).where(TestRun.id == failure.test_run_id))
        run = res_run.scalars().first()
        if run:
            lines.append(f"        # Initial navigation fallback")
            lines.append(f"        await page.goto('{run.base_url}', wait_until='domcontentloaded')")
            lines.append(f"        await asyncio.sleep(1)")
            lines.append("")

    step = 1
    for action in actions:
        lines.append(f"        # Step {step}: {action.action_type} -> {action.target_selector or 'N/A'}")
        
        if action.action_type == "navigate":
            url = action.value or action.target_selector
            lines.append(f"        print('Navigating to {url}')")
            lines.append(f"        await page.goto('{url}', wait_until='domcontentloaded')")
        elif action.action_type == "click":
            lines.append(f"        print('Clicking {action.target_selector}')")
            lines.append(f"        locator = page.locator('{action.target_selector}').first")
            lines.append(f"        await locator.wait_for(state='visible', timeout=5000)")
            lines.append(f"        await locator.click()")
        elif action.action_type == "fill":
            val = action.value or ''
            # Escape single quotes in value
            val_escaped = val.replace("'", "\\'")
            lines.append(f"        print('Filling {action.target_selector} with {val}')")
            lines.append(f"        locator = page.locator('{action.target_selector}').first")
            lines.append(f"        await locator.wait_for(state='visible', timeout=5000)")
            lines.append(f"        await locator.fill('{val_escaped}')")
        elif action.action_type == "check":
            lines.append(f"        print('Checking {action.target_selector}')")
            lines.append(f"        locator = page.locator('{action.target_selector}').first")
            lines.append(f"        await locator.wait_for(state='visible', timeout=5000)")
            lines.append(f"        await locator.check()")
        
        lines.append(f"        await asyncio.sleep(1)")  # brief pause for stability
        lines.append("")
        step += 1

    lines.extend([
        "        print('Reproduction sequence finished.')",
        "        print('Browser will stay open for 10 seconds to inspect the failure state.')",
        "        await asyncio.sleep(10)",
        "        await browser.close()",
        "",
        "if __name__ == '__main__':",
        "    asyncio.run(reproduce_failure())",
        ""
    ])

    return "\n".join(lines)