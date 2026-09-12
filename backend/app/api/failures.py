"""Failures API router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.schemas.failure import FailureRead
from app.schemas.evidence import EvidenceRead
from app.services import failure_service, evidence_service

router = APIRouter(prefix="/failures", tags=["failures"])

@router.get("/{failure_id}", response_model=FailureRead)
async def get_failure(failure_id: str, db: AsyncSession = Depends(get_db)):
    failure = await failure_service.get_failure_with_evidence(db, failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="Failure not found")
    return failure

@router.get("/{failure_id}/evidence", response_model=List[EvidenceRead])
async def get_failure_evidence(failure_id: str, db: AsyncSession = Depends(get_db)):
    # Verify failure exists
    failure = await failure_service.get_failure_with_evidence(db, failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="Failure not found")
    return await evidence_service.get_evidence_for_failure(db, failure_id)