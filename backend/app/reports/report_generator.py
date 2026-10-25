"""Bug Report Generator – synthesizes chaos test runs into comprehensive reports.

Supported export formats:
- Markdown (default, GitHub/Jira compatible)
- HTML (standalone, self-contained styled report)
- JSON (raw structured data for automation/CI pipelines)
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.test_run import TestRun
from app.models.project import Project
from app.models.page import Page
from app.models.action import Action
from app.models.state import State
from app.models.failure import Failure
from app.models.evidence import Evidence
from app.services.failure_service import get_unique_failures_for_run


async def collect_report_data(db: AsyncSession, run_id: str) -> Optional[Dict[str, Any]]:
    """Gather all run data, metrics, pages, actions, and classified failures."""
    run_res = await db.execute(select(TestRun).where(TestRun.id == run_id))
    run = run_res.scalars().first()
    if not run:
        return None

    proj_res = await db.execute(select(Project).where(Project.id == run.project_id))
    project = proj_res.scalars().first()

    # Pages
    pages_res = await db.execute(select(Page).where(Page.test_run_id == run_id))
    pages = list(pages_res.scalars().all())

    # Actions
    actions_res = await db.execute(
        select(Action).where(Action.test_run_id == run_id).order_by(Action.created_at.asc())
    )
    actions = list(actions_res.scalars().all())

    # Unique DOM States
    states_res = await db.execute(select(State).where(State.test_run_id == run_id))
    states = list(states_res.scalars().all())

    # Raw Failures with evidence
    failures_res = await db.execute(
        select(Failure)
        .options(selectinload(Failure.evidence))
        .where(Failure.test_run_id == run_id)
        .order_by(Failure.created_at.asc())
    )
    raw_failures = list(failures_res.scalars().all())

    # Deduplicated Classified Failures
    unique_failures = await get_unique_failures_for_run(db, run_id)

    # Compute metric summaries
    actions_by_type: Dict[str, int] = {}
    for a in actions:
        actions_by_type[a.action_type] = actions_by_type.get(a.action_type, 0) + 1

    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    cat_counts: Dict[str, int] = {}
    for f in unique_failures:
        sev = f["severity"].lower()
        if sev in sev_counts:
            sev_counts[sev] += 1
        cat = f["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    return {
        "run": {
            "id": run.id,
            "status": run.status.value if hasattr(run.status, "value") else str(run.status),
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "duration_ms": run.duration_ms,
            "error_message": run.error_message,
        },
        "project": {
            "id": project.id if project else None,
            "name": project.name if project else "Unknown Project",
            "url": project.url if project else "",
            "testing_objective": project.testing_objective if project else None,
        },
        "metrics": {
            "total_pages_visited": len(pages),
            "unique_states_discovered": len(states),
            "total_actions_executed": len([a for a in actions if a.status == "success"]),
            "total_actions_generated": len(actions),
            "actions_by_type": actions_by_type,
            "total_raw_failures": len(raw_failures),
            "unique_failures_count": len(unique_failures),
            "severity_breakdown": sev_counts,
            "category_breakdown": cat_counts,
        },
        "pages": [{"url": p.url, "title": p.title, "depth": p.depth} for p in pages],
        "unique_failures": unique_failures,
        "raw_failures_count": len(raw_failures),
    }


def generate_markdown_report(data: Dict[str, Any]) -> str:
    """Render a GitHub/Jira compatible Markdown report."""
    run = data["run"]
    proj = data["project"]
    m = data["metrics"]
    unique_failures = data["unique_failures"]

    dur_sec = f"{round((run['duration_ms'] or 0) / 1000, 1)}s" if run["duration_ms"] else "N/A"
    started = run["started_at"] or "N/A"
    finished = run["finished_at"] or "N/A"

    lines = [
        f"# 🤖 Chaos Test Report — {proj['name']}",
        "",
        f"> **Target URL:** `{proj['url']}`  ",
        f"> **Run ID:** `{run['id']}`  ",
        f"> **Status:** `{run['status']}` | **Duration:** {dur_sec}  ",
        f"> **Generated at:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
        "| Metric | Result |",
        "|:-------|:-------|",
        f"| **Test Status** | `{run['status']}` |",
        f"| **Pages Explored** | {m['total_pages_visited']} |",
        f"| **DOM States Discovered** | {m['unique_states_discovered']} |",
        f"| **Chaos Interactions Executed** | {m['total_actions_executed']} |",
        f"| **Total Raw Failure Events** | {m['total_raw_failures']} |",
        f"| **Unique Issues Identified** | **{m['unique_failures_count']}** |",
        "",
        "### Severity Breakdown",
        "",
        f"- 🔴 **Critical:** {m['severity_breakdown']['critical']}",
        f"- 🟠 **High:** {m['severity_breakdown']['high']}",
        f"- 🟡 **Medium:** {m['severity_breakdown']['medium']}",
        f"- 🟢 **Low:** {m['severity_breakdown']['low']}",
        "",
        "---",
        "",
        "## 2. Identified Bugs & Failures",
        "",
    ]

    if not unique_failures:
        lines.append("✅ **No application failures were detected during this test run.**\n")
    else:
        for idx, f in enumerate(unique_failures, 1):
            sev_badge = {
                "critical": "🔴 CRITICAL",
                "high": "🟠 HIGH",
                "medium": "🟡 MEDIUM",
                "low": "🟢 LOW",
            }.get(f["severity"].lower(), f["severity"].upper())

            lines.extend([
                f"### Issue #{idx}: {f['message'][:120]}",
                "",
                f"- **Severity:** {sev_badge}",
                f"- **Category:** `{f['category']}`",
                f"- **Failure Type:** `{f['failure_type']}`",
                f"- **Occurrences:** `{f['occurrence_count']} time(s)`",
                f"- **Fingerprint:** `{f['fingerprint_hash']}`",
                f"- **First Seen:** {f['first_seen'].strftime('%Y-%m-%d %H:%M:%S UTC') if hasattr(f['first_seen'], 'strftime') else f['first_seen']}",
                "",
            ])

            if f.get("root_cause_hint"):
                lines.extend([
                    "**💡 Root Cause Diagnostic & Suggested Fix:**",
                    f"> {f['root_cause_hint']}",
                    "",
                ])

            lines.append("---")
            lines.append("")

    # Section 3: Discovered Pages
    lines.extend([
        "## 3. Discovered Pages",
        "",
        "| Depth | Title | URL |",
        "|:-----:|:------|:----|",
    ])
    for p in data["pages"][:30]:
        title = (p["title"] or "Untitled").replace("|", "-")
        lines.append(f"| {p['depth']} | {title} | `{p['url']}` |")

    if len(data["pages"]) > 30:
        lines.append(f"\n*... and {len(data['pages']) - 30} more pages.*")

    lines.extend([
        "",
        "---",
        "",
        "*Report generated autonomously by [AI Website Chaos Tester](https://github.com/Bikki-Rana/ai-chaos-website-tester)*",
        ""
    ])

    return "\n".join(lines)


def generate_html_report(data: Dict[str, Any]) -> str:
    """Generate a self-contained, beautifully styled HTML bug report."""
    run = data["run"]
    proj = data["project"]
    m = data["metrics"]
    unique_failures = data["unique_failures"]

    dur_sec = f"{round((run['duration_ms'] or 0) / 1000, 1)}s" if run["duration_ms"] else "N/A"

    failure_cards_html = ""
    if not unique_failures:
        failure_cards_html = """
        <div class="empty-state">
            <h3>✅ Clean Run</h3>
            <p>No failures or exceptions were detected during this chaos test run.</p>
        </div>
        """
    else:
        for idx, f in enumerate(unique_failures, 1):
            sev = f["severity"].lower()
            hint_html = f"<div class='hint'>💡 {f['root_cause_hint']}</div>" if f.get("root_cause_hint") else ""
            failure_cards_html += f"""
            <div class="failure-card sev-{sev}">
                <div class="failure-header">
                    <span class="badge badge-{sev}">{sev.upper()}</span>
                    <span class="category-pill">{f['category']}</span>
                    <span class="count-pill">×{f['occurrence_count']} occurrence{'s' if f['occurrence_count'] != 1 else ''}</span>
                    <span class="fp">#{f['fingerprint_hash']}</span>
                </div>
                <div class="failure-title">{f['message']}</div>
                {hint_html}
            </div>
            """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chaos Test Report — {proj['name']}</title>
    <style>
        :root {{
            --bg: #090a0f;
            --surface: #121520;
            --surface2: #1b2030;
            --border: #242b40;
            --text: #e2e8f0;
            --muted: #94a3b8;
            --cyan: #00f7ff;
            --crit: #ef4444;
            --high: #f97316;
            --med: #eab308;
            --low: #22c55e;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 32px 16px;
        }}
        .container {{ max-width: 900px; margin: 0 auto; }}
        header {{
            border-bottom: 1px solid var(--border);
            padding-bottom: 24px;
            margin-bottom: 32px;
        }}
        h1 {{ font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }}
        h2 {{ font-size: 20px; font-weight: 700; color: #fff; margin: 32px 0 16px; }}
        .meta {{ color: var(--muted); font-size: 14px; font-family: monospace; }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }}
        .card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
        }}
        .card-num {{ font-size: 24px; font-weight: 800; color: var(--cyan); }}
        .card-label {{ font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }}
        .failure-card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
            border-left: 4px solid var(--border);
        }}
        .failure-card.sev-critical {{ border-left-color: var(--crit); }}
        .failure-card.sev-high {{ border-left-color: var(--high); }}
        .failure-card.sev-medium {{ border-left-color: var(--med); }}
        .failure-card.sev-low {{ border-left-color: var(--low); }}
        .failure-header {{ display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }}
        .badge {{
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }}
        .badge-critical {{ background: rgba(239, 68, 68, 0.2); color: var(--crit); }}
        .badge-high {{ background: rgba(249, 115, 22, 0.2); color: var(--high); }}
        .badge-medium {{ background: rgba(234, 179, 8, 0.2); color: var(--med); }}
        .badge-low {{ background: rgba(34, 197, 94, 0.2); color: var(--low); }}
        .category-pill {{
            background: var(--surface2);
            color: var(--cyan);
            font-size: 11px;
            font-family: monospace;
            padding: 2px 8px;
            border-radius: 4px;
        }}
        .count-pill {{
            background: var(--surface2);
            color: var(--muted);
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }}
        .fp {{ font-size: 12px; color: var(--muted); font-family: monospace; margin-left: auto; }}
        .failure-title {{ font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 8px; }}
        .hint {{
            background: var(--surface2);
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 13px;
            color: var(--text);
            margin-top: 10px;
            border-left: 3px solid var(--cyan);
        }}
        .empty-state {{
            text-align: center;
            padding: 40px;
            background: var(--surface);
            border: 1px dashed var(--border);
            border-radius: 8px;
        }}
        footer {{
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
            text-align: center;
            color: var(--muted);
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⚡ Chaos Test Bug Report</h1>
            <div class="meta">
                Project: {proj['name']} ({proj['url']})<br>
                Run ID: {run['id']} &bull; Status: {run['status']} &bull; Duration: {dur_sec}
            </div>
        </header>

        <h2>1. Executive Summary</h2>
        <div class="grid">
            <div class="card">
                <div class="card-num">{m['unique_failures_count']}</div>
                <div class="card-label">Unique Bugs</div>
            </div>
            <div class="card">
                <div class="card-num">{m['total_pages_visited']}</div>
                <div class="card-label">Pages Explored</div>
            </div>
            <div class="card">
                <div class="card-num">{m['unique_states_discovered']}</div>
                <div class="card-label">DOM States</div>
            </div>
            <div class="card">
                <div class="card-num">{m['total_actions_executed']}</div>
                <div class="card-label">Interactions</div>
            </div>
        </div>

        <h2>2. Identified Issues ({m['unique_failures_count']})</h2>
        {failure_cards_html}

        <footer>
            Generated by AI Website Chaos Tester &bull; {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
        </footer>
    </div>
</body>
</html>
"""


async def generate_report(db: AsyncSession, run_id: str, fmt: str = "markdown") -> Optional[str]:
    """Top-level entry point to render a report in markdown, html, or json."""
    data = await collect_report_data(db, run_id)
    if not data:
        return None

    if fmt == "json":
        # Custom serializer for datetimes
        def _default(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        return json.dumps(data, indent=2, default=_default)
    elif fmt == "html":
        return generate_html_report(data)
    else:
        return generate_markdown_report(data)