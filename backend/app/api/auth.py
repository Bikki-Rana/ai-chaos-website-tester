"""Auth API router."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import DUMMY_HASH, create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserRead
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserRead.model_validate(user),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    if await user_service.get_user_by_email(db, body.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    try:
        user = await user_service.create_user(db, body.email, body.password)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_email(db, body.email)
    stored = user.password_hash if user else DUMMY_HASH
    ok = await asyncio.to_thread(verify_password, body.password, stored)
    if user is None or not ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _auth_response(user)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    return user