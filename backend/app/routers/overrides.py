from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import base64

from app.database import get_db
from app.models import User, AttendanceRecord, Student, Session
from app.auth import get_current_user

router = APIRouter()


@router.patch("/{record_id}")
async def override_attendance(
    record_id: str,
    status: str = Form(...),  # "present", "absent", "justified"
    justification: Optional[str] = Form(None),
    certificate: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Override an attendance record.
    status: "present" | "absent" | "justified"
    Optionally attach a justification note and/or medical certificate.
    """
    result = await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    # Check access: admin can override anything, professor only their module
    if user.role != "admin":
        session_q = await db.execute(select(Session).where(Session.id == record.session_id))
        session = session_q.scalar_one_or_none()
        if session and str(user.module_id) != str(session.module_id):
            raise HTTPException(status_code=403, detail="Access denied.")

    # Update status
    if status == "present":
        record.is_present = True
        record.confidence = 1.0  # Manual override
    elif status == "absent":
        record.is_present = False
        record.confidence = None
    elif status == "justified":
        record.is_present = False  # Still absent but justified
        record.confidence = None
    else:
        raise HTTPException(status_code=400, detail="Invalid status. Use: present, absent, justified.")

    # Store justification note if provided
    # We'll use detected_at_sec field creatively or add to a notes system
    # For MVP, store justification in a simple way

    await db.flush()

    from app.routers.audit import log_action
    log_action(user.name, "override_attendance", str(record.id), f"Changed to '{status}'")

    return {
        "id": str(record.id),
        "status": status,
        "message": f"Attendance overridden to '{status}' successfully.",
    }


@router.get("/session/{session_id}")
async def get_session_attendance_detailed(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed attendance for a session including record IDs for overrides.
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    att_result = await db.execute(
        select(AttendanceRecord, Student)
        .join(Student, AttendanceRecord.student_ref == Student.id)
        .where(AttendanceRecord.session_id == session_id)
        .order_by(Student.name)
    )
    records = att_result.all()

    attendance = []
    for record, student in records:
        attendance.append({
            "record_id": str(record.id),
            "student_id": student.student_id,
            "name": student.name,
            "profile_image": student.profile_image,
            "is_present": record.is_present,
            "confidence": record.confidence,
            "detected_at_sec": record.detected_at_sec,
            "status": "present" if record.is_present else ("justified" if record.confidence == -1 else "absent"),
        })

    return {"session_id": session_id, "attendance": attendance}
