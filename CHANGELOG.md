# Changelog

All notable changes to the **AI Website Chaos Tester** framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-10-25

### Phase 11: Failure Classification & Deduplication
- **Added**:
  - `failure_classifier.py` module for real-time error telemetry enrichment.
  - Deterministic 12-character SHA-1 error fingerprinting (`fingerprint_hash`) with `normalise_message()` stripping volatile tokens (UUIDs, timestamps, line/column numbers, query strings).
  - 6-category failure taxonomy:
    - `UNCAUGHT_JS_EXCEPTION` (TypeErrors, ReferenceErrors, ChunkLoadErrors)
    - `SERVER_5XX` (HTTP 500, 502, 503)
    - `DEAD_ASSET_OR_LINK` (HTTP 404)
    - `AUTH_OR_SECURITY` (HTTP 401, 403)
    - `NAVIGATION_TIMEOUT` (Playwright timeouts, crashed navigations)
    - `RESOURCE_FAILURE` (Network dropouts, DNS failures)
  - Dynamic severity scoring adjusting signal strength based on blast radius (e.g. 5xx and syntax crashes scored as `CRITICAL`).
  - Automated rule-based root cause diagnostics (`root_cause_hint`) explaining runtime errors and suggesting fixes.
  - Database schema columns on `Failure` model: `fingerprint_hash`, `category`, `occurrence_count`, `root_cause_hint`.
  - Startup database migration in `migrate.py` to add classification columns automatically.
  - Endpoint `GET /api/v1/runs/{id}/unique-failures` returning deduplicated failure groups with occurrence counts.
  - Frontend `FailureSummaryCard` component and dedicated `🔬 Classified` tab in `RunDetailPage.tsx`.
  - Enriched `FailureRow.tsx` with category badges, fingerprint hash, and expandable root cause hints.
  - Unit test suite `test_failure_classifier.py` covering fingerprinting, taxonomy, severity scoring, and enrichment (8/8 tests passing).

### Phase 12: Bug Report Generator
- **Added**:
  - `report_generator.py` synthesis engine compiling complete chaos test runs into multi-format reports.
  - Markdown export format (`.md`) compatible with GitHub Issues and Jira containing executive metrics, severity tables, and bug index.
  - Standalone styled HTML export format (`.html`) featuring dark mode cyber theme and self-contained CSS.
  - Structured JSON export format (`.json`) for CI/CD pipeline automation.
  - API endpoint `GET /api/v1/runs/{id}/report?format=markdown|html|json`.
  - One-click `Report (MD)` and `Report (HTML)` export buttons in `RunDetailPage.tsx`.
  - Unit test suite `test_report_generator.py` (all tests passing).
- **Changed**:
  - Fixed `.gitignore` to prevent Python package directories (`backend/app/reports/` and `backend/app/evidence/`) from being ignored.
  - Removed tracked local SQLite binary database from repository.

---

## [0.2.0] - 2026-10-24

### Phase 13: Full Dashboard & UI/UX Redesign
- **Added**:
  - Complete user authentication system: Sign In, Sign Up, Forgot Password, and Reset Password via SMTP mailer (`backend/app/core/mailer.py`).
  - Interactive 3D `ChaosCube.tsx` using CSS 3D transforms.
  - Animated `ChaosHero.tsx` with live metric count-ups (`useCountUp.ts`).
  - Project management capabilities: project renaming dialog, delete dialog with cascade, pinning, and sort order.
  - Local offline draft system (`drafts.ts`, `DraftProjectPage.tsx`) allowing guest users to configure tests before registering.
  - `SettingsPage.tsx` with profile management, password change, draft cleanup, and backend health monitor.
  - Cyber-themed glow styles and responsive design across all pages.

### Production Crawling & Cloud Infrastructure
- **Added**:
  - Dedicated `CrawlPolicy` engine (`backend/app/agent/crawl_policy.py`) enforcing same-site boundaries, URL normalization, non-crawlable file filtering, and page interaction budgets.
  - Working run cancellation (`STOPPED` state) with immediate loop termination.
  - Startup housekeeping routine (`backend/app/db/maintenance.py`) marking orphaned runs as `FAILED` on server restart.
  - Cloud PostgreSQL SSL connection support for remote hosting (Render/Supabase) via `asyncpg`.
  - Vercel deployment rewrites configuration (`frontend/vercel.json`).
  - Auto-fallback to local SQLite (`chaosdb.db`) when running in local development mode without cloud credentials.

---

## [0.1.5] - 2026-10-07

### Phase 7: Chaos Generator (Active Action Execution)
- **Added**:
  - `agent_engine.py` maintaining a single continuous Playwright context across actions.
  - `action_executor.py` executing dynamic `click`, `fill`, `check`, and `navigate` interactions.
  - Active autonomous agent loop coordinating DOM extraction, action heuristics, and DB state updates.

### Phase 8: Failure Detector
- **Added**:
  - `failure_detector.py` parsing `PageInfo` for JavaScript console errors, HTTP 4xx/5xx responses, and Playwright navigation errors.
  - Automatic persistence of detected errors to the `failures` database table.

### Phase 9: Evidence Collector
- **Added**:
  - Automatic linking of screenshots and structured DOM/network logs to `Failure` records via `Evidence` model.
  - Asynchronous screenshot serving endpoint `GET /api/v1/failures/{id}/evidence/{evidence_id}/content`.
  - Inline screenshot viewer preview in the frontend.

### Phase 10: Failure Reproduction
- **Added**:
  - `reproducer_service.py` tracing test run action history leading to a failure.
  - Automatic generation of standalone, runnable Playwright Python reproduction scripts.
  - API endpoint `GET /api/v1/failures/{id}/reproduction-script`.
  - One-click script download button in failure cards.

---

## [0.1.2] - 2026-09-26

### Phase 4: State Management
- **Added**:
  - `state_manager.py` computing SHA-256 structural DOM signatures from extracted elements.
  - State deduplication preventing redundant actions on unchanged views.

### Phase 5 & 6: Action Generation & Selection
- **Added**:
  - `action_generator.py` extracting interactive DOM candidates and generating contextual inputs.
  - `action_selector.py` prioritizing unexplored states and unvisited action elements.
  - Pending actions queue in database and `GET /api/v1/runs/{id}/actions/next` endpoint.

---

## [0.1.0] - 2026-09-12

### Phase 2: FastAPI Backend Core
- **Added**:
  - Async SQLAlchemy ORM models (`User`, `Project`, `TestRun`, `Page`, `Action`, `State`, `Failure`, `Evidence`, `BugReport`).
  - REST API routers for projects, runs, and failures.
  - SQLite development database support and Alembic migration structure.

### Phase 3: Web Crawler Prototype
- **Added**:
  - Breadth-first search link discovery engine with configurable `max_pages` and `max_depth`.

---

## [0.0.1] - 2026-08-24

### Phase 0 & Phase 1: Prototype & Automation Engine
- **Added**:
  - Project repository structure initialized.
  - Docker Compose environment with PostgreSQL, Redis, backend, frontend, and demo site.
  - Playwright browser automation engine with page element extraction (buttons, links, inputs, forms).
  - Intentionally buggy Flask demo site with 5 seeded application bugs.
  - CLI test runner: `python -m app.browser.test_runner`.
  - Initial `README.md` and `ARCHITECTURE.md`.
