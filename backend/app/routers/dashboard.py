"""
Dashboard stats endpoint — overview data for the home page.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, Student, Module, Session, AttendanceRecord
from app.auth import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get overview stats for the dashboard."""
    # Total students
    students_q = await db.execute(select(func.count(Student.id)))
    total_students = students_q.scalar() or 0

    # Total modules
    modules_q = await db.execute(select(func.count(Module.id)))
    total_modules = modules_q.scalar() or 0

    # Total completed sessions
    sessions_q = await db.execute(
        select(func.count(Session.id)).where(Session.status == "completed")
    )
    total_sessions = sessions_q.scalar() or 0

    # Overall attendance rate
    total_records_q = await db.execute(select(func.count(AttendanceRecord.id)))
    total_records = total_records_q.scalar() or 0

    present_records_q = await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.is_present == True)
    )
    present_records = present_records_q.scalar() or 0

    overall_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Recent sessions (last 5)
    recent_q = await db.execute(
        select(Session, Module)
        .join(Module, Session.module_id == Module.id)
        .where(Session.status == "completed")
        .order_by(Session.created_at.desc())
        .limit(5)
    )
    recent_sessions = [
        {
            "id": str(s.id),
            "module_code": m.code,
            "module_name": m.name,
            "week_number": s.week_number,
            "date": s.session_date.isoformat() if s.session_date else None,
        }
        for s, m in recent_q.all()
    ]

    # At-risk count (students with 3+ absences in any module)
    students_all = await db.execute(select(Student))
    all_students = students_all.scalars().all()
    modules_all = await db.execute(select(Module))
    all_modules = modules_all.scalars().all()

    at_risk_count = 0
    for student in all_students:
        for module in all_modules:
            abs_q = await db.execute(
                select(func.count(AttendanceRecord.id))
                .join(Session, AttendanceRecord.session_id == Session.id)
                .where(Session.module_id == module.id)
                .where(AttendanceRecord.student_ref == student.id)
                .where(AttendanceRecord.is_present == False)
            )
            if (abs_q.scalar() or 0) >= 3:
                at_risk_count += 1
                break

    return {
        "total_students": total_students,
        "total_modules": total_modules,
        "total_sessions": total_sessions,
        "overall_rate": round(overall_rate, 1),
        "at_risk_count": at_risk_count,
        "recent_sessions": recent_sessions,
    }
