"""Failure service – retrieval and deduplication helpers."""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.failure import Failure


async def get_failures_for_run(
    session: AsyncSession,
    run_id: str,
) -> List[Failure]:
    result = await session.execute(
        select(Failure)
        .options(selectinload(Failure.evidence))
        .where(Failure.test_run_id == run_id)
        .order_by(Failure.created_at)
    )
    return list(result.scalars().all())


async def get_failure_with_evidence(
    session: AsyncSession,
    failure_id: str,
) -> Optional[Failure]:
    result = await session.execute(
        select(Failure)
        .options(selectinload(Failure.evidence))
        .where(Failure.id == failure_id)
    )
    return result.scalar_one_or_none()


async def get_unique_failures_for_run(
    session: AsyncSession,
    run_id: str,
) -> List[Dict]:
    """
    Return one representative Failure per unique fingerprint_hash,
    with occurrence_count aggregated and failure_ids collected.
    Used for the deduplicated summary view.
    """
    failures = await get_failures_for_run(session, run_id)

    # Group by fingerprint (fall back to id for unclassified rows)
    groups: Dict[str, List[Failure]] = defaultdict(list)
    for f in failures:
        key = f.fingerprint_hash or f.id
        groups[key].append(f)

    summaries = []
    for fp, members in groups.items():
        members_sorted = sorted(members, key=lambda f: f.created_at)
        rep = members_sorted[0]  # oldest is the canonical representative

        # Collect the failure IDs for reference
        ids = [m.id for m in members_sorted]

        first_seen: datetime = members_sorted[0].created_at
        last_seen: datetime  = members_sorted[-1].created_at

        # Make timestamps timezone-aware for serialisation
        if first_seen.tzinfo is None:
            first_seen = first_seen.replace(tzinfo=timezone.utc)
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        summaries.append({
            "fingerprint_hash":  fp,
            "failure_type":      rep.failure_type,
            "category":          rep.category or "UNKNOWN",
            "severity":          rep.severity,
            "message":           rep.message,
            "root_cause_hint":   rep.root_cause_hint,
            "occurrence_count":  len(members),
            "first_seen":        first_seen,
            "last_seen":         last_seen,
            "failure_ids":       ids,
        })

    # Sort: critical first, then by occurrence count desc
    _sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    summaries.sort(key=lambda s: (_sev_order.get(s["severity"], 9), -s["occurrence_count"]))
    return summaries