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
    """Return a screenshot belonging to an authorized failure."""

    result = await db.execute(
        select(Evidence).where(
            Evidence.id == evidence_id,
            Evidence.failure_id == failure.id,
        )
    )
    evidence = result.scalar_one_or_none()

    if evidence is None or evidence.evidence_type != "screenshot":
        raise HTTPException(status_code=404, detail="Screenshot not found")

    image_path = Path(evidence.file_path).resolve()

    # Allow only page.png files inside the expected screenshots directory.
    project_root = Path(__file__).resolve().parents[3]
    allowed_roots = {
        (project_root / "screenshots").resolve(),
        Path("/screenshots").resolve(),
    }

    if image_path.name != "page.png":
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if not any(image_path.is_relative_to(root) for root in allowed_roots):
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if not image_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Screenshot file not found. It may have been removed during a redeployment.",
        )

    return FileResponse(
        path=image_path,
        media_type="image/png",
        filename="screenshot.png",
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
