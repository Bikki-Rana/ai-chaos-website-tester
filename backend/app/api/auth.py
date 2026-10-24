"""Auth API router."""
import asyncio
import hmac
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.mailer import send_reset_email
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    create_reset_token,
    decode_reset_token,
    password_fingerprint,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    UserRead,
)
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])

_RESET_COOLDOWN_SECONDS = 60
_last_reset_request: dict = {}


def _allow_reset(email: str) -> bool:
    """At most one reset email per address per minute (in-memory)."""
    now = time.monotonic()
    if len(_last_reset_request) > 1000:
        for key, ts in list(_last_reset_request.items()):
            if now - ts > _RESET_COOLDOWN_SECONDS:
                del _last_reset_request[key]
    last = _last_reset_request.get(email)
    if last is not None and now - last < _RESET_COOLDOWN_SECONDS:
        return False
    _last_reset_request[email] = now
    return True


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


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_email(db, body.email)
    if user is not None and _allow_reset(body.email):
        token = create_reset_token(user.id, user.password_hash)
        link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
        # Sent in the background and the reply is always identical, so the
        # response never reveals whether an account exists.
        background_tasks.add_task(send_reset_email, user.email, link)
    return MessageResponse(message="If an account exists for that email, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    parsed = decode_reset_token(body.token)
    if parsed is None:
        raise invalid
    user_id, fingerprint = parsed
    user = await db.get(User, user_id)
    if user is None or not hmac.compare_digest(fingerprint, password_fingerprint(user.password_hash)):
        raise invalid
    await user_service.set_password(db, user, body.password)
    return MessageResponse(message="Password updated. You can now sign in.")

from pydantic import BaseModel, Field


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await asyncio.to_thread(verify_password, body.current_password, user.password_hash)
    if not ok:
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    await user_service.set_password(db, user, body.new_password)
    return MessageResponse(message="Password updated.")