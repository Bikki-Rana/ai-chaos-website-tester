"""Run executor - bridges Playwright extraction with DB persistence."""
import structlog
from app.db.session import async_session_maker
from app.models.test_run import RunStatus
from app.models.page import Page
from app.models.action import Action
from app.models.state import State
from app.models.failure import Failure
from app.crawler.crawler_engine import crawl
from app.state.state_manager import compute_state_signature
from app.agent.action_generator import generate_actions
from datetime import datetime, timezone
from datetime import datetime, timezone

logger = structlog.get_logger(__name__)

async def _mark_status(run_id: str, status: RunStatus, error: str = None) -> None:
    """Open a brand-new session just to flip run status."""
    from datetime import datetime, timezone
    async with async_session_maker() as s:
        run = await s.get(__import__("app.models.test_run", fromlist=["TestRun"]).TestRun, run_id)
        if run is None:
            return
        run.status = status
        now_utc = datetime.now(timezone.utc)
        if status == RunStatus.RUNNING:
            run.started_at = now_utc
        elif status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.STOPPED):
            run.finished_at = now_utc
            if run.started_at:
                started = run.started_at
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                delta = run.finished_at - started
                run.duration_ms = delta.total_seconds() * 1000
        if error:
            run.error_message = error
        await s.commit()

async def execute_test_run(
    run_id: str,
    project_id: str,
    url: str,
    headless: bool = True,
    timeout_ms: int = 30000,
    max_pages: int = 10,
    max_depth: int = 2
) -> None:
    """Run a full Playwright extraction and persist all results to the DB."""
    logger.info("starting_test_run_execution", run_id=run_id, url=url, max_pages=max_pages, max_depth=max_depth)

    all_errors = []

    try:
        # We iterate over pages yielded by the crawler
        async for page_info, depth in crawl(url, run_id, max_pages, max_depth, headless, timeout_ms):
            
            # Record errors if any
            if page_info.errors:
                all_errors.extend(page_info.errors)

            # Compute State Signature
            dom_hash, state_data = compute_state_signature(page_info)

            # --- Persist results in one session per page ---
            async with async_session_maker() as session:
                # Page record
                page = Page(
                    project_id=project_id,
                    test_run_id=run_id,
                    url=page_info.url,
                    final_url=page_info.final_url,
                    title=page_info.title,
                    load_time_ms=page_info.duration_ms,
                    screenshot_path=page_info.screenshot_path,
                    depth=depth
                )
                session.add(page)
                await session.flush()  # assigns page.id

                # State record
                state = State(
                    test_run_id=run_id,
                    page_id=page.id,
                    dom_hash=dom_hash,
                    state_data=state_data
                )
                session.add(state)

                # Generate and persist actionable tasks
                generated_actions = generate_actions(page_info)
                for act in generated_actions:
                    session.add(Action(
                        test_run_id=run_id,
                        page_id=page.id,
                        action_type=act["action_type"],
                        target_selector=act["target_selector"],
                        value=act["value"],
                        status=act["status"]
                    ))

                # Failures: console errors/warnings
                for msg in page_info.console_messages:
                    if msg.level in ("error", "warning"):
                        session.add(Failure(
                            test_run_id=run_id,
                            page_id=page.id,
                            failure_type="console_error",
                            message=msg.text,
                            severity="high" if msg.level == "error" else "medium",
                        ))

                # Failures: network failures
                for net in page_info.network_events:
                    if net.failed:
                        session.add(Failure(
                            test_run_id=run_id,
                            page_id=page.id,
                            failure_type="network_error",
                            message=f"Failed {net.url}: {net.failure_reason}",
                            severity="high",
                        ))

                await session.commit()

        # --- Flip run status in fresh session ---
        if all_errors:
            await _mark_status(run_id, RunStatus.FAILED, "\n".join(all_errors))
            logger.info("test_run_finished", run_id=run_id, status="FAILED")
        else:
            await _mark_status(run_id, RunStatus.COMPLETED)
            logger.info("test_run_finished", run_id=run_id, status="COMPLETED")

    except Exception as exc:
        logger.error("test_run_execution_error", run_id=run_id, error=str(exc))
        try:
            await _mark_status(run_id, RunStatus.FAILED, str(exc))
        except Exception as inner:
            logger.error("could_not_mark_failed", run_id=run_id, error=str(inner))