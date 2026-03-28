from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client, create_client

from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    supabase_uid: str


class AuthResponse(BaseModel):
    user_id: UUID
    email: EmailStr


def _supabase_client() -> Client:
    supabase_key = settings.supabase_service_key or settings.supabase_anon_key
    return create_client(settings.supabase_url, supabase_key)


async def _verify_supabase_jwt(token: str):
    try:
        client = _supabase_client()
        user_response = client.auth.get_user(token)
        user = user_response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid Supabase token.",
        ) from exc

    if user is None or not user.id or not user.email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: unable to resolve Supabase user.",
        )

    return user


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: missing Bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: missing token value.",
        )

    supabase_user = await _verify_supabase_jwt(token)
    query = select(User).where(User.supabase_uid == str(supabase_user.id))
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None:
        # Auto-provision local profile for users created directly in Supabase.
        user = User(email=str(supabase_user.email), supabase_uid=str(supabase_user.id))
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not payload.password.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required.")

    existing_by_email = await db.execute(select(User).where(User.email == payload.email))
    if existing_by_email.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    existing_by_uid = await db.execute(select(User).where(User.supabase_uid == payload.supabase_uid))
    if existing_by_uid.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supabase UID already registered.")

    user = User(email=str(payload.email), supabase_uid=payload.supabase_uid)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(user_id=user.id, email=user.email)


@router.post("/login", response_model=AuthResponse)
async def login(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: missing Bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: missing token value.",
        )

    supabase_user = await _verify_supabase_jwt(token)
    result = await db.execute(select(User).where(User.supabase_uid == str(supabase_user.id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Virtual Security Officer user not found.")

    return AuthResponse(user_id=user.id, email=user.email)


@router.get("/me", response_model=AuthResponse)
async def me(current_user: User = Depends(get_current_user)):
    return AuthResponse(user_id=current_user.id, email=current_user.email)
