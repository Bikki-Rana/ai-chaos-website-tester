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
| 0     | Project Initialization  | ✅ Complete |
| 1     | Browser Automation      | ✅ Complete |
| 2     | FastAPI Backend         | ✅ Complete |
| 3     | Web Crawler             | ✅ Complete |
| 4     | State Management        | ✅ Complete |
| 5     | Action Generator        | ✅ Complete |
| 6     | Action Selection        | ✅ Complete |
| 7     | Chaos Generator         | ✅ Complete |
| 8     | Failure Detector        | ✅ Complete |
| 9     | Evidence Collector      | ✅ Complete |
| 10    | Failure Reproduction    | ✅ Complete |
| 11    | Failure Classification  | ✅ Complete |
| 12    | Bug Report Generator    | ✅ Complete |
| 13    | Frontend Dashboard      | ✅ Complete |

## Key Design Decisions

- **No LLM dependency**: System works without any API keys (rules-based first)
- **Safety first**: Safe mode ON by default, only tests explicitly provided domains
- **Headless by default**: `--headed` flag for visual debugging on Windows
- **Modular AI**: AIProvider abstraction allows swapping rules → LLM later
- **Evidence-driven**: Every suspected failure captures screenshot, DOM, console, network logs
