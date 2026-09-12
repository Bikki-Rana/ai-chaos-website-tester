# Changelog

All notable changes to AI Website Chaos Tester are documented here.

## [Unreleased] — Phase 0 + Phase 1

### Added
- Project repository structure initialized
- Docker Compose environment with PostgreSQL, Redis, backend, frontend, demo-site
- FastAPI backend skeleton with GET /health endpoint
- React + TypeScript + Tailwind frontend skeleton with health check page
- Playwright browser automation engine (Phase 1 prototype)
  - Page extraction: buttons, links, inputs, forms, selects, textareas
  - Screenshot capture
  - Console message capture
  - Network request/response capture
  - Structured JSON evidence/action log output
- CLI test runner: `python -m app.browser.test_runner --url <URL> [--headed]`
- Local intentionally buggy demo site (Flask) with 5 seeded bugs
- pytest browser automation tests
- README.md with Windows native + Docker setup guides
- ARCHITECTURE.md describing system design
- .env.example with all configuration options
