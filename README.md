# AI Website Chaos Tester

**Autonomous AI-Driven Web Application Chaos Testing and Failure Discovery Framework**

> **Phase 2 Complete**: Project management, persistent test runs, REST API, browser-to-DB integration, React frontend, SQLite local dev, PostgreSQL in Docker.

---

## Architecture

```
Explore -> Understand -> Select -> Execute -> Observe -> Detect -> Reproduce -> Report -> Learn
```

### Technology Stack
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy (async), Alembic, Structlog
- **Database**: SQLite (local dev, auto-created) / PostgreSQL (Docker)
- **Browser Automation**: Playwright (Chromium), headless by default
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Test Target**: Local Flask app with intentionally seeded bugs

---

## Project Structure

```
ai-chaos-tester/
+-- backend/
|   +-- app/
|   |   +-- main.py              # FastAPI entry point
|   |   +-- core/                # Config, logging
|   |   +-- db/                  # SQLAlchemy engine, session
|   |   +-- models/              # SQLAlchemy ORM models
|   |   +-- schemas/             # Pydantic schemas
|   |   +-- services/            # Business logic layer
|   |   +-- api/                 # FastAPI routers
|   |   +-- browser/             # Playwright extraction + run_executor
|   +-- alembic/                 # Database migrations
|   +-- tests/                   # pytest test suite
|   +-- requirements.txt
+-- frontend/
|   +-- src/
|   |   +-- App.tsx              # React Router root
|   |   +-- pages/               # ProjectsPage, ProjectDetailPage, RunDetailPage
|   |   +-- services/api.ts      # Typed API client
|   |   +-- types/index.ts       # Shared TypeScript types
+-- demo-site/                   # Intentionally buggy Flask app
+-- docker-compose.yml
+-- .env.example
```

---

## Phase Status

| Phase | Description                    | Status    |
|-------|--------------------------------|-----------|
| 0     | Project Initialization         | DONE      |
| 1     | Browser Automation Prototype   | DONE      |
| 2     | Project & Run Management + API | DONE      |
| 3     | Web Crawler                    | planned   |
| 4     | State Management               | planned   |
| 5-6   | Action Generation / Selection  | planned   |
| 7     | Chaos Generator                | planned   |
| 8     | Failure Detector               | planned   |
| 9     | Evidence Collector             | planned   |
| 10    | Failure Reproduction           | planned   |
| 11    | Failure Classification         | planned   |
| 12    | Bug Report Generator           | planned   |
| 13    | Full Dashboard                 | planned   |

---

## Windows Native Setup (no Docker)

### Requirements
- Python 3.11+ (tested on 3.14.3)
- Node.js 20+

### 1. Create virtual environment

```powershell
cd ai-chaos-tester
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install Python dependencies

```powershell
pip install -r backend\requirements.txt
playwright install chromium
```

### 3. Install Playwright system dependencies

```powershell
playwright install-deps   # if on Linux/WSL; not needed on Windows
```

### 4. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 5. Set environment variables (optional)

Copy `.env.example` to `.env`. Defaults work for local dev (SQLite):
```
DATABASE_URL=sqlite+aiosqlite:///./chaosdb.db   # auto-selected locally
```

### 6. Database migrations (SQLite - auto-runs on startup)

Tables are created automatically on first startup. To run Alembic manually:

```powershell
cd backend
..\.venv\Scripts\alembic.exe upgrade head
```

### 7. Run everything (3 terminals)

**Terminal 1 - Demo site:**
```powershell
.venv\Scripts\python.exe demo-site\app.py
```

**Terminal 2 - Backend API:**
```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend --port 8000
```

**Terminal 3 - Frontend dev server:**
```powershell
cd frontend && npm run dev
```

Then open http://localhost:5173 in your browser.

---

## Docker Setup

```powershell
docker compose up --build
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Backend docs: http://localhost:8000/docs
- Demo Site: http://localhost:5000
- PostgreSQL: localhost:5432

---

## API Reference (Phase 2)

| Method   | Endpoint                         | Description              |
|----------|----------------------------------|--------------------------|
| GET      | /health                          | Server health check      |
| POST     | /api/v1/projects/                | Create project           |
| GET      | /api/v1/projects/                | List all projects        |
| GET      | /api/v1/projects/{id}            | Get project              |
| DELETE   | /api/v1/projects/{id}            | Delete project           |
| POST     | /api/v1/projects/{id}/runs       | Create new test run      |
| GET      | /api/v1/projects/{id}/runs       | List runs for project    |
| GET      | /api/v1/runs/{id}                | Get run details          |
| POST     | /api/v1/runs/{id}/start          | Start run (triggers Playwright) |
| POST     | /api/v1/runs/{id}/stop           | Stop running run         |
| GET      | /api/v1/runs/{id}/pages          | Pages discovered         |
| GET      | /api/v1/runs/{id}/actions        | Actions recorded         |
| GET      | /api/v1/runs/{id}/failures       | Failures detected        |
| GET      | /api/v1/failures/{id}            | Get failure details      |
| GET      | /api/v1/failures/{id}/evidence   | Failure evidence files   |

Interactive docs: http://localhost:8000/docs

---

## Running Tests

```powershell
# From repo root, with demo-site running
cd backend
..\.venv\Scripts\pytest.exe tests/ -v
```

Expected: **16 passed** (12 browser + 2 API + 2 DB)

---

## Run With Headed Browser (watch automation)

```powershell
.venv\Scripts\python.exe -m app.browser.test_runner --url http://localhost:5000 --headed
```