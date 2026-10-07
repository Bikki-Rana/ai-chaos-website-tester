"""Action Executor - executes generated actions using Playwright."""
import structlog
from playwright.async_api import Page, TimeoutError

logger = structlog.get_logger(__name__)

async def execute_action(page: Page, action: dict, timeout_ms: int = 5000) -> bool:
    """
    Executes a single action on the Playwright page.
    Returns True if successful, False if it failed.
    """
    action_type = action.get("action_type")
    selector = action.get("target_selector")
    value = action.get("value")

    logger.info("executing_action", action_type=action_type, selector=selector, value=value)

    try:
        if action_type == "navigate":
            await page.goto(value, timeout=timeout_ms)
            await page.wait_for_load_state("domcontentloaded")
            return True

        if not selector:
            logger.error("missing_selector_for_action", action=action)
            return False

        # Wait for the element to be visible/actionable
        locator = page.locator(selector).first
        await locator.wait_for(state="visible", timeout=timeout_ms)

        if action_type == "click":
            await locator.click(timeout=timeout_ms)
        elif action_type == "fill":
            await locator.fill(value or "", timeout=timeout_ms)
        elif action_type == "check":
            await locator.check(timeout=timeout_ms)
        else:
            logger.warning("unknown_action_type", action_type=action_type)
            return False

        # Wait briefly for any JS handlers or navigations to settle
        await page.wait_for_timeout(1000)
        return True

    except TimeoutError:
        logger.warning("action_timeout", action_type=action_type, selector=selector)
        return False
    except Exception as e:
        logger.error("action_execution_failed", action_type=action_type, selector=selector, error=str(e))
        return False