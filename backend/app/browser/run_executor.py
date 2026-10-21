"""Run Executor - orchestrates a chaos test run.

The crawl decisions (which page next, which element to poke) live in
app.agent.crawl_policy. This module saves what the bot sees and does.
"""
import structlog
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.action_generator import generate_actions
from app.agent.agent_engine import run_agent_loop
from app.agent.crawl_policy import STEPS_PER_PAGE, CrawlPolicy
from app.agent.failure_detector import detect_failures
from app.core.config import settings
from app.db.session import async_session_maker
from app.models.action import Action
from app.models.evidence import Evidence
from app.models.failure import Failure
from app.models.page import Page
from app.models.state import State
from app.models.test_run import RunStatus, TestRun
from app.state.state_manager import compute_state_signature

logger = structlog.get_logger(__name__)


async def _persist_action(db: AsyncSession, run_id: str, page_id: Optional[str], act: Dict[str, Any]) -> str:
    """Save the action the bot is about to perform. It is marked 'success' on the next step."""
    row = Action(
        test_run_id=run_id,
        page_id=page_id,
        action_type=act["action_type"],
        target_selector=act.get("target_selector"),
        value=act.get("value"),
        status="pending",
    )
    db.add(row)
    await db.flush()
    return row.id


async def _finalize(run_id: str, status: RunStatus, error: Optional[str] = None) -> None:
    """Close the run, unless the user already stopped it."""
    async with async_session_maker() as db:
        run = await db.get(TestRun, run_id)
        if run is None or run.status == RunStatus.STOPPED:
            return
        now = datetime.now(timezone.utc)
        run.status = status
        run.finished_at = now
        if error:
            run.error_message = error[:2000]
        if run.started_at:
            started = run.started_at if run.started_at.tzinfo else run.started_at.replace(tzinfo=timezone.utc)
            run.duration_ms = (now - started).total_seconds() * 1000
        await db.commit()


async def execute_test_run(
    run_id: str,
    url: str,
    max_pages: int = 10,
    max_depth: int = 3,
    headless: bool = True,
    timeout_ms: int = 30000,
) -> None:
    policy = CrawlPolicy(url, max_pages, max_depth)
    # Safety net so a run always ends, whatever the site does.
    max_steps = min(settings.max_actions_per_run, policy.max_pages * STEPS_PER_PAGE + 3)
    logger.info(
        "starting_test_run_execution",
        run_id=run_id, url=url, max_pages=policy.max_pages, max_depth=policy.max_depth, max_steps=max_steps,
    )

    async with async_session_maker() as db:
        run = await db.get(TestRun, run_id)
        project_id = run.project_id if run else None
    if not project_id:
        logger.error("cannot_resolve_project_for_run", run_id=run_id)
        return

    page_ids: Dict[str, str] = {}      # normalized url -> Page row (one row per unique page)
    seen_states = set()                # (normalized url, dom hash): one State row per distinct state
    last_action_id: Optional[str] = None

    async def action_callback(page_info) -> Optional[Dict[str, Any]]:
        nonlocal last_action_id

        async with async_session_maker() as db:
            # The action from the previous step has been performed by now.
            if last_action_id:
                await db.execute(update(Action).where(Action.id == last_action_id).values(status="success"))
                last_action_id = None

            # Stop button: end the loop as soon as the run is marked STOPPED.
            run_row = await db.get(TestRun, run_id)
            if run_row is None or run_row.status == RunStatus.STOPPED:
                await db.commit()
                return None

            hrefs = [link.href for link in page_info.links if link.href]
            verdict, depth = policy.observe(page_info.final_url, hrefs)

            if verdict == "limit":  # maximum pages reached
                await db.commit()
                return None

            if verdict != "ok":  # left the site (or too deep): go back
                back = policy.back_action()
                if back:
                    last_action_id = await _persist_action(db, run_id, None, back)
                await db.commit()
                return back

            # One Page row per unique page, one State row per distinct DOM state.
            cur = policy.current
            sig, state_data = compute_state_signature(page_info)
            page_id = page_ids.get(cur)
            if page_id is None:
                db_page = Page(
                    test_run_id=run_id,
                    project_id=project_id,
                    url=page_info.final_url,
                    title=page_info.title,
                    depth=depth,
                    load_time_ms=page_info.duration_ms,
                    screenshot_path=page_info.screenshot_path,
                )
                db.add(db_page)
                await db.flush()
                page_id = db_page.id
                page_ids[cur] = page_id
            if (cur, sig) not in seen_states:
                seen_states.add((cur, sig))
                db.add(State(test_run_id=run_id, page_id=page_id, dom_hash=sig, state_data=state_data))
                await db.flush()

            # Failures seen on this step, with their evidence.
            for f_data in detect_failures(page_info):
                db_failure = Failure(
                    test_run_id=run_id,
                    page_id=page_id,
                    failure_type=f_data["failure_type"],
                    message=f_data["message"],
                    stack_trace=f_data["stack_trace"],
                    severity=f_data["severity"],
                )
                db.add(db_failure)
                await db.flush()
                if page_info.screenshot_path:
                    db.add(Evidence(
                        failure_id=db_failure.id,
                        evidence_type="screenshot",
                        file_path=page_info.screenshot_path,
                    ))
                if getattr(page_info, "action_log_path", None):
                    db.add(Evidence(
                        failure_id=db_failure.id,
                        evidence_type="action_log",
                        file_path=page_info.action_log_path,
                    ))
            await db.flush()

            # Links are followed by the crawl policy, so only interactions are candidates here.
            candidates = [a for a in generate_actions(page_info) if a["action_type"] != "navigate"]
            selected = policy.choose(candidates)
            if selected:
                last_action_id = await _persist_action(db, run_id, page_id, selected)

            await db.commit()
            return selected

    try:
        async for _ in run_agent_loop(
            start_url=url,
            run_id=run_id,
            max_actions=max_steps,
            headless=headless,
            timeout_ms=timeout_ms,
            action_callback=action_callback,
        ):
            pass
    except Exception as e:
        detail = f"{type(e).__name__}: {e}".rstrip(": ")
        logger.error("test_run_fatal_error", run_id=run_id, error=detail, traceback=traceback.format_exc())
        await _finalize(run_id, RunStatus.FAILED, detail)
        return

    if not policy.visited:
        await _finalize(run_id, RunStatus.FAILED, "Could not open the start URL.")
        return

    await _finalize(run_id, RunStatus.COMPLETED)
    logger.info("test_run_finished", run_id=run_id, status="COMPLETED", pages=len(policy.visited))