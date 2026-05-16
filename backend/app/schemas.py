from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# --- Students ---

class StudentEnrollResponse(BaseModel):
    id: UUID
    student_id: str
    name: str
    email: Optional[str] = None
    profile_image: Optional[str] = None
    enrolled_at: datetime

    class Config:
        from_attributes = True


class StudentProfile(BaseModel):
    id: UUID
    student_id: str
    name: str
    email: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: datetime
    attendance_rate: float = 0.0  # percentage

    class Config:
        from_attributes = True


class StudentAttendanceDetail(BaseModel):
    module_code: str
    module_name: str
    total_sessions: int
    attended: int
    rate: float


# --- Modules ---

class ModuleCreate(BaseModel):
    name: str
    code: str
    professor: Optional[str] = None
    total_weeks: int = 14


class ModuleResponse(BaseModel):
    id: UUID
    name: str
    code: str
    professor: Optional[str] = None
    total_weeks: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Sessions ---

class SessionCreateResponse(BaseModel):
    session_id: UUID
    module_id: UUID
    week_number: int
    status: str
    ws_url: str


class SessionResponse(BaseModel):
    id: UUID
    module_id: UUID
    module_name: Optional[str] = None
    module_code: Optional[str] = None
    week_number: int
    status: str
    session_date: datetime
    present_count: int = 0
    absent_count: int = 0

    class Config:
        from_attributes = True


# --- Attendance ---

class AttendanceEntry(BaseModel):
    student_id: str
    name: str
    profile_image: Optional[str] = None
    is_present: bool
    confidence: Optional[float] = None


class SessionAttendanceResponse(BaseModel):
    session_id: UUID
    module_name: str
    week_number: int
    status: str
    total_students: int
    present_count: int
    absent_count: int
    attendance: list[AttendanceEntry]


# --- Errors ---

class ErrorResponse(BaseModel):
    detail: str
