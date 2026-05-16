from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import User, Student
from app.auth import verify_password, create_access_token, get_current_user

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfile(BaseModel):
    id: str
    username: str
    name: str
    role: str
    profile_image: Optional[str] = None
    module_id: Optional[str] = None


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Unified login endpoint.
    Tries admin/professor first (by username), then student (by email).
    """
    # Try admin/professor login (username match)
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if user and verify_password(data.password, user.password_hash):
        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(
            access_token=token,
            user={
                "id": str(user.id),
                "username": user.username,
                "name": user.name,
                "role": user.role,
                "profile_image": user.profile_image,
                "module_id": str(user.module_id) if user.module_id else None,
            },
        )

    # Try student login (email match, password is 12341234)
    student_q = await db.execute(select(Student).where(Student.email == data.username))
    student = student_q.scalar_one_or_none()

    if student and data.password == "12341234":
        token = create_access_token({"sub": str(student.id), "role": "student", "student_id": student.student_id})
        return LoginResponse(
            access_token=token,
            user={
                "id": str(student.id),
                "username": student.email,
                "name": student.name,
                "role": "student",
                "profile_image": student.profile_image,
                "module_id": None,
                "student_id": student.student_id,
            },
        )

    raise HTTPException(status_code=401, detail="Invalid credentials.")


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserProfile(
        id=str(user.id),
        username=user.username,
        name=user.name,
        role=user.role,
        profile_image=user.profile_image,
        module_id=str(user.module_id) if user.module_id else None,
    )
