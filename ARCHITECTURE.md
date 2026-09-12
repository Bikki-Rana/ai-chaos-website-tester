# Architecture — AI Website Chaos Tester

## Overview

AI Website Chaos Tester is a monorepo autonomous web-application testing platform.
It crawls web applications, generates chaotic interactions, detects failures, collects evidence,
and produces professional bug reports.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Dashboard                           │
│                   (frontend / port 3000)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                             │
│                    (backend / port 8000)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Crawler │ │  Agent   │ │ Detector │ │  Report Generator│  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────────────┘  │
│       │             │             │                               │
│  ┌────▼─────────────▼─────────────▼──────────┐                 │
│  │           Browser Automation Layer          │                 │
│  │              (Playwright)                   │                 │
│  └────────────────────────────────────────────┘                 │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐  ┌──────────┐  ┌──────────────┐
    │   PostgreSQL     │  │  Redis   │  │  Target App  │
    │  (port 5432)     │  │ (6379)   │  │  (any URL)   │
    └─────────────────┘  └──────────┘  └──────────────┘
```

## Phase Status

| Phase | Name                    | Status      |
|-------|-------------------------|-------------|
| 0     | Project Initialization  | ✅ Complete  |
| 1     | Browser Automation      | ✅ Complete  |
| 2     | FastAPI Backend         | 🔲 Planned  |
| 3     | Web Crawler             | 🔲 Planned  |
| 4     | State Management        | 🔲 Planned  |
| 5     | Action Generator        | 🔲 Planned  |
| 6     | Action Selection        | 🔲 Planned  |
| 7     | Chaos Generator         | 🔲 Planned  |
| 8     | Failure Detector        | 🔲 Planned  |
| 9     | Evidence Collector      | 🔲 Planned  |
| 10    | Failure Reproduction    | 🔲 Planned  |
| 11    | Failure Classification  | 🔲 Planned  |
| 12    | Bug Report Generator    | 🔲 Planned  |
| 13    | Frontend Dashboard      | 🔲 Planned  |

## Key Design Decisions

- **No LLM dependency**: System works without any API keys (rules-based first)
- **Safety first**: Safe mode ON by default, only tests explicitly provided domains
- **Headless by default**: `--headed` flag for visual debugging on Windows
- **Modular AI**: AIProvider abstraction allows swapping rules → LLM later
- **Evidence-driven**: Every suspected failure captures screenshot, DOM, console, network logs
