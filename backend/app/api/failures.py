
"""Failures API router."""

from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_failure
from app.db.session import get_db
from app.models.evidence import Evidence
from app.models.failure import Failure
from app.schemas.failure import FailureRead
from app.schemas.evidence import EvidenceRead
from app.services import evidence_service
from app.services.reproducer_service import generate_reproduction_script

router = APIRouter(prefix="/failures", tags=["failures"])


@router.get("/{failure_id}", response_model=FailureRead)
async def get_failure(
    failure: Failure = Depends(get_owned_failure),
):
    return failure


@router.get("/{failure_id}/evidence", response_model=List[EvidenceRead])
async def get_failure_evidence(
    failure: Failure = Depends(get_owned_failure),
    db: AsyncSession = Depends(get_db),
):
    return await evidence_service.get_evidence_for_failure(db, failure.id)


@router.get("/{failure_id}/evidence/{evidence_id}/content")
async def get_screenshot_content(
    evidence_id: str,
    failure: Failure = Depends(get_owned_failure),
    db: AsyncSession = Depends(get_db),
):
    """Serve a screenshot attached to an authorized failure."""

    result = await db.execute(
        select(Evidence).where(
            Evidence.id == evidence_id,
            Evidence.failure_id == failure.id,
        )
    )
    evidence = result.scalar_one_or_none()

    if evidence is None or evidence.evidence_type != "screenshot":
        raise HTTPException(status_code=404, detail="Screenshot not found")

    project_root = Path(__file__).resolve().parents[3]
    screenshots_root = (project_root / "screenshots").resolve()

    # Support both relative paths and absolute paths recorded by the extractor.
    stored_path = Path(evidence.file_path)
    candidates = []

    if stored_path.is_absolute():
        candidates.append(stored_path.resolve())
    else:
        candidates.append((project_root / stored_path).resolve())

        # Some records use paths prefixed with "screenshots/".
        if stored_path.parts and stored_path.parts[0] == "screenshots":
            candidates.append(
                (project_root.joinpath(*stored_path.parts)).resolve()
            )

    image_path = next(
        (
            candidate
            for candidate in candidates
            if candidate.is_relative_to(screenshots_root)
            and candidate.is_file()
            and candidate.suffix.lower() == ".png"
        ),
        None,
    )

    if image_path is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Screenshot file not found on the backend. "
                "It may have been removed during a redeployment."
            ),
        )

    return FileResponse(
        path=image_path,
        media_type="image/png",
        filename=image_path.name,
    )


@router.get(
    "/{failure_id}/reproduction-script",
    response_class=PlainTextResponse,
)
async def get_reproduction_script(
    failure: Failure = Depends(get_owned_failure),
    db: AsyncSession = Depends(get_db),
):
    script_content = await generate_reproduction_script(db, failure.id)

    if not script_content:
        raise HTTPException(
            status_code=400,
            detail="Could not generate script",
        )

    return script_content