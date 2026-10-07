"""User service."""
import asyncio
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(session: AsyncSession, email: str, password: str) -> User:
    # Hashing is CPU-heavy by design; keep it off the event loop.
    password_hash = await asyncio.to_thread(hash_password, password)
    user = User(email=email, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user