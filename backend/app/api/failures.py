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

from fastapi.responses import PlainTextResponse
from app.services.reproducer_service import generate_reproduction_script

@router.get("/{failure_id}/reproduction-script", response_class=PlainTextResponse)
async def get_reproduction_script(failure_id: str, db: AsyncSession = Depends(get_db)):
    # Verify failure exists
    failure = await failure_service.get_failure_with_evidence(db, failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="Failure not found")
        
    script_content = await generate_reproduction_script(db, failure_id)
    if not script_content:
        raise HTTPException(status_code=400, detail="Could not generate script")
        
    return script_content