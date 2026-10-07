"""Run Executor - orchestrates the Chaos testing loops (Phase 7: Agent Loop)."""
import structlog
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any

from app.db.session import async_session_maker
from app.models.test_run import TestRun
from app.models.page import Page
from app.models.state import State
from app.models.action import Action
from app.models.failure import Failure
from app.models.evidence import Evidence
from app.state.state_manager import compute_state_signature
from app.agent.action_generator import generate_actions
from app.agent.action_selector import select_next_action
from app.agent.failure_detector import detect_failures
from app.agent.agent_engine import run_agent_loop

logger = structlog.get_logger(__name__)


async def _save_page_and_state(db: AsyncSession, run_id: str, project_id: str, page_info, depth: int) -> tuple[str, str]:
    """Persist page and state records. Returns (page_id, state_id)."""
    # 1. Compute state signature
    state_sig, state_data = compute_state_signature(page_info)

    # 2. Save page first (we need its id for state FK)
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

    # 3. Save state (linked to this page)
    db_state = State(
        test_run_id=run_id,
        page_id=page_id,
        dom_hash=state_sig,
        state_data=state_data
    )
    db.add(db_state)
    await db.flush()
    state_id = db_state.id

    return page_id, state_id


async def _generate_and_save_actions(db: AsyncSession, run_id: str, page_id: str, page_info) -> list:
    """Generate actions for the page and persist them. Returns list of Action models."""
    generated = generate_actions(page_info)
    saved_actions = []

    # Don't duplicate pending actions for the same selector on this page
    existing_res = await db.execute(
        select(Action).where(Action.test_run_id == run_id, Action.page_id == page_id)
    )
    existing_targets = {a.target_selector: a for a in existing_res.scalars().all()}

    for act_dict in generated:
        if act_dict["target_selector"] not in existing_targets:
            db_action = Action(
                test_run_id=run_id,
                page_id=page_id,
                action_type=act_dict["action_type"],
                target_selector=act_dict["target_selector"],
                value=act_dict.get("value"),
                status="pending"
            )
            db.add(db_action)
            await db.flush()
            saved_actions.append(db_action)
        else:
            saved_actions.append(existing_targets[act_dict["target_selector"]])

    return saved_actions


async def execute_test_run(
    run_id: str,
    url: str,
    max_pages: int = 10,
    max_depth: int = 3,
    headless: bool = True,
    timeout_ms: int = 30000
) -> None:
    logger.info("starting_test_run_execution", run_id=run_id, url=url, max_actions=max_pages)

    # Resolve project_id
    async with async_session_maker() as db:
        run = (await db.execute(select(TestRun).where(TestRun.id == run_id))).scalars().first()
        project_id = run.project_id if run else None

    if not project_id:
        logger.error("cannot_resolve_project_for_run", run_id=run_id)
        return

    current_depth = 0
    last_action_id: Optional[str] = None

    try:
        async def action_callback(page_info) -> Optional[Dict[str, Any]]:
            nonlocal current_depth, last_action_id

            async with async_session_maker() as db:
                # Persist page + state
                page_id, state_id = await _save_page_and_state(db, run_id, project_id, page_info, current_depth)

                # Mark previous action as success
                if last_action_id:
                    await db.execute(
                        update(Action).where(Action.id == last_action_id).values(status="success")
                    )

                # Detect + save failures
                failures_data = detect_failures(page_info)
                for f_data in failures_data:
                    db_failure = Failure(
                        test_run_id=run_id,
                        page_id=page_id,
                        failure_type=f_data["failure_type"],
                        message=f_data["message"],
                        stack_trace=f_data["stack_trace"],
                        severity=f_data["severity"]
                    )
                    db.add(db_failure)
                    await db.flush()

                    if page_info.screenshot_path:
                        db.add(Evidence(
                            failure_id=db_failure.id,
                            evidence_type="screenshot",
                            file_path=page_info.screenshot_path
                        ))
                    if getattr(page_info, "action_log_path", None):
                        db.add(Evidence(
                            failure_id=db_failure.id,
                            evidence_type="action_log",
                            file_path=page_info.action_log_path
                        ))
                await db.flush()

                # Generate + save pending actions
                saved_actions = await _generate_and_save_actions(db, run_id, page_id, page_info)

                # Select next action
                action_dicts = [
                    {
                        "id": a.id,
                        "action_type": a.action_type,
                        "target_selector": a.target_selector,
                        "value": a.value,
                        "status": a.status,
                    }
                    for a in saved_actions if a.status == "pending"
                ]

                selected = select_next_action(action_dicts)
                last_action_id = selected["id"] if selected else None

                await db.commit()

            current_depth += 1
            return selected

        # Run the active agent loop
        async for _ in run_agent_loop(
            start_url=url,
            run_id=run_id,
            max_actions=max_pages,
            headless=headless,
            timeout_ms=timeout_ms,
            action_callback=action_callback
        ):
            pass

    except Exception as e:
        logger.error("test_run_fatal_error", run_id=run_id, error=str(e))
        async with async_session_maker() as db:
            run = (await db.execute(select(TestRun).where(TestRun.id == run_id))).scalars().first()
            if run:
                run.status = "FAILED"
                run.error_message = str(e)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
        return

    # Mark as COMPLETED
    async with async_session_maker() as db:
        run = (await db.execute(select(TestRun).where(TestRun.id == run_id))).scalars().first()
        if run:
            run.status = "COMPLETED"
            run.completed_at = datetime.now(timezone.utc)
            if run.started_at:
                started = run.started_at
                if started.tzinfo is None:
                    from datetime import timezone as tz
                    started = started.replace(tzinfo=tz.utc)
                run.duration_ms = int((run.completed_at - started).total_seconds() * 1000)
            await db.commit()

    logger.info("test_run_finished", run_id=run_id, status="COMPLETED")