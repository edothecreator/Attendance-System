"""
Student Self-Service Portal.
Students log in with their CNE and view their own attendance.
"""
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Student, Module, Session, AttendanceRecord
from app.auth import create_access_token

router = APIRouter()


@router.post("/login")
async def student_login(
    email: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Student logs in with their email and password (12341234)."""
    if password != "12341234":
        raise HTTPException(status_code=401, detail="Invalid password.")

    result = await db.execute(select(Student).where(Student.email == email))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=401, detail="No student account found with this email.")

    token = create_access_token({"sub": str(student.id), "role": "student", "student_id": student.student_id})

    return {
        "access_token": token,
        "user": {
            "id": str(student.id),
            "student_id": student.student_id,
            "name": student.name,
            "email": student.email,
            "role": "student",
            "profile_image": student.profile_image,
        },
    }


@router.get("/my-attendance/{student_id}")
async def get_my_attendance(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full attendance data for a student (used by student portal)."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    # Overall stats
    total_q = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
    )
    total_records = total_q.scalar() or 0

    present_q = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
        .where(AttendanceRecord.is_present == True)
    )
    present_records = present_q.scalar() or 0

    overall_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Per-module breakdown
    module_data = []
    for module in modules:
        mod_total_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
        )
        mod_total = mod_total_q.scalar() or 0

        mod_present_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
            .where(AttendanceRecord.is_present == True)
        )
        mod_present = mod_present_q.scalar() or 0

        mod_rate = (mod_present / mod_total * 100) if mod_total > 0 else 0

        # Get weekly detail
        weeks = []
        sessions_q = await db.execute(
            select(Session).where(Session.module_id == module.id)
            .where(Session.status == "completed").order_by(Session.week_number)
        )
        sessions = sessions_q.scalars().all()

        for session in sessions:
            att_q = await db.execute(
                select(AttendanceRecord)
                .where(AttendanceRecord.session_id == session.id)
                .where(AttendanceRecord.student_ref == student.id)
            )
            att = att_q.scalar_one_or_none()
            weeks.append({
                "week": session.week_number,
                "present": att.is_present if att else None,
                "date": session.session_date.isoformat() if session.session_date else None,
                "session_id": str(session.id),
            })

        module_data.append({
            "module_code": module.code,
            "module_name": module.name,
            "total_sessions": mod_total,
            "present": mod_present,
            "absent": mod_total - mod_present,
            "rate": round(mod_rate, 1),
            "weeks": weeks,
        })

    return {
        "student": {
            "name": student.name,
            "student_id": student.student_id,
            "email": student.email,
            "profile_image": student.profile_image,
        },
        "overall_rate": round(overall_rate, 1),
        "total_sessions": total_records,
        "total_present": present_records,
        "total_absent": total_records - present_records,
        "modules": module_data,
    }
