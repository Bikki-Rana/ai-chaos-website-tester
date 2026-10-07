"""Failures API router."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.api.deps import get_owned_failure
from app.db.session import get_db
from app.models.failure import Failure
from app.schemas.failure import FailureRead
from app.schemas.evidence import EvidenceRead
from app.services import evidence_service
from app.services.reproducer_service import generate_reproduction_script

router = APIRouter(prefix="/failures", tags=["failures"])


@router.get("/{failure_id}", response_model=FailureRead)
async def get_failure(failure: Failure = Depends(get_owned_failure)):
    return failure


@router.get("/{failure_id}/evidence", response_model=List[EvidenceRead])
async def get_failure_evidence(
    failure: Failure = Depends(get_owned_failure),
    db: AsyncSession = Depends(get_db),
):
    return await evidence_service.get_evidence_for_failure(db, failure.id)


@router.get("/{failure_id}/reproduction-script", response_class=PlainTextResponse)
async def get_reproduction_script(
    failure: Failure = Depends(get_owned_failure),
    db: AsyncSession = Depends(get_db),
):
    script_content = await generate_reproduction_script(db, failure.id)
    if not script_content:
        raise HTTPException(status_code=400, detail="Could not generate script")

    return script_content