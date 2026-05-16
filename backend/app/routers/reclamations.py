"""
Reclamation system — students submit absence justifications,
professors approve/decline them.
"""
import base64
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Student, Session, Module, AttendanceRecord, Reclamation
from app.auth import get_current_user, require_professor
from app.services.email_service import send_reclamation_result_email
from app.config import settings

router = APIRouter()


@router.post("/submit")
async def submit_reclamation(
    student_id: str = Form(...),
    session_id: str = Form(...),
    message: str = Form(...),
    attachment: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Student submits a reclamation for a specific session."""
    # Find student
    student_q = await db.execute(select(Student).where(Student.student_id == student_id))
    student = student_q.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Find session
    session_q = await db.execute(select(Session).where(Session.id == session_id))
    session = session_q.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Check student was actually absent in this session
    att_q = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.session_id == session_id)
        .where(AttendanceRecord.student_ref == student.id)
    )
    record = att_q.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=400, detail="No attendance record found for this session.")
    if record.is_present:
        raise HTTPException(status_code=400, detail="You are already marked as present for this session.")

    # Check for existing pending reclamation
    existing_q = await db.execute(
        select(Reclamation)
        .where(Reclamation.student_ref == student.id)
        .where(Reclamation.session_id == session_id)
        .where(Reclamation.status == "pending")
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending reclamation for this session.")

    # Handle attachment
    attachment_b64 = None
    if attachment:
        content = await attachment.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(status_code=400, detail="Attachment too large (max 5MB).")
        attachment_b64 = f"data:{attachment.content_type};base64,{base64.b64encode(content).decode()}"

    # Create reclamation
    reclamation = Reclamation(
        student_ref=student.id,
        session_id=session_id,
        message=message,
        attachment=attachment_b64,
        status="pending",
    )
    db.add(reclamation)
    await db.flush()
    await db.commit()

    # Notify professor via in-app notification with link
    from app.routers.notifications import add_notification
    add_notification(
        title="New Reclamation",
        message=f"{student.name} submitted a justification for {module.code} Week {session.week_number}.",
        type="info",
        for_role="professor",
        link="/reclamations",
    )

    # Email the professor
    from app.services.email_service import send_reclamation_notification_to_prof
    prof_q = await db.execute(select(User).where(User.module_id == session.module_id))
    prof = prof_q.scalar_one_or_none()
    if prof:
        # Use the SMTP_FROM as prof email for now (or we could add email field to User)
        send_reclamation_notification_to_prof(
            professor_email=settings.smtp_from,  # sends to app email, prof sees in notifications
            professor_name=prof.name,
            student_name=student.name,
            student_id=student.student_id,
            module_name=module.name,
            module_code=module.code,
            week_number=session.week_number,
            message=message,
        )

    return {"message": "Reclamation submitted successfully.", "id": str(reclamation.id)}


@router.get("/student/{student_id}")
async def get_student_reclamations(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all reclamations for a student."""
    student_q = await db.execute(select(Student).where(Student.student_id == student_id))
    student = student_q.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    result = await db.execute(
        select(Reclamation, Session, Module)
        .join(Session, Reclamation.session_id == Session.id)
        .join(Module, Session.module_id == Module.id)
        .where(Reclamation.student_ref == student.id)
        .order_by(Reclamation.created_at.desc())
    )
    rows = result.all()

    return {
        "reclamations": [
            {
                "id": str(r.id),
                "session_id": str(r.session_id),
                "module_code": m.code,
                "module_name": m.name,
                "week_number": s.week_number,
                "message": r.message,
                "has_attachment": r.attachment is not None,
                "status": r.status,
                "professor_response": r.professor_response,
                "created_at": r.created_at.isoformat(),
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            }
            for r, s, m in rows
        ]
    }


@router.get("/pending")
async def get_pending_reclamations(
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Get all pending reclamations (for professor's module or all for admin)."""
    query = (
        select(Reclamation, Student, Session, Module)
        .join(Student, Reclamation.student_ref == Student.id)
        .join(Session, Reclamation.session_id == Session.id)
        .join(Module, Session.module_id == Module.id)
        .where(Reclamation.status == "pending")
        .order_by(Reclamation.created_at.desc())
    )

    if user.role != "admin":
        query = query.where(Session.module_id == user.module_id)

    result = await db.execute(query)
    rows = result.all()

    return {
        "reclamations": [
            {
                "id": str(r.id),
                "student_name": st.name,
                "student_id": st.student_id,
                "student_email": st.email,
                "profile_image": st.profile_image,
                "module_code": m.code,
                "module_name": m.name,
                "week_number": s.week_number,
                "message": r.message,
                "has_attachment": r.attachment is not None,
                "attachment": r.attachment,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r, st, s, m in rows
        ]
    }


@router.post("/{reclamation_id}/resolve")
async def resolve_reclamation(
    reclamation_id: str,
    decision: str = Form(...),  # "approved" or "declined"
    response: str = Form(""),
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Professor approves or declines a reclamation."""
    if decision not in ("approved", "declined"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'declined'.")

    rec_q = await db.execute(select(Reclamation).where(Reclamation.id == reclamation_id))
    reclamation = rec_q.scalar_one_or_none()
    if not reclamation:
        raise HTTPException(status_code=404, detail="Reclamation not found.")

    if reclamation.status != "pending":
        raise HTTPException(status_code=400, detail="This reclamation has already been resolved.")

    # Update reclamation
    reclamation.status = decision
    reclamation.professor_response = response or None
    reclamation.resolved_at = datetime.utcnow()

    # If approved, mark attendance as justified (present=False but confidence=-1 to indicate justified)
    if decision == "approved":
        att_q = await db.execute(
            select(AttendanceRecord)
            .where(AttendanceRecord.session_id == reclamation.session_id)
            .where(AttendanceRecord.student_ref == reclamation.student_ref)
        )
        record = att_q.scalar_one_or_none()
        if record:
            record.is_present = False
            record.confidence = -1.0  # -1 means justified

    await db.flush()
    await db.commit()

    # Send email to student
    student_q = await db.execute(select(Student).where(Student.id == reclamation.student_ref))
    student = student_q.scalar_one_or_none()

    session_q = await db.execute(select(Session).where(Session.id == reclamation.session_id))
    session = session_q.scalar_one_or_none()

    module_q = await db.execute(select(Module).where(Module.id == session.module_id)) if session else None
    module = module_q.scalar_one_or_none() if module_q else None

    if student and student.email:
        send_reclamation_result_email(
            student_name=student.name,
            student_email=student.email,
            module_name=module.name if module else "Unknown",
            module_code=module.code if module else "",
            week_number=session.week_number if session else 0,
            decision=decision,
            professor_response=response,
            professor_name=user.name,
        )

    from app.routers.audit import log_action
    log_action(user.name, f"reclamation_{decision}", str(reclamation.id), f"{student.name if student else 'Unknown'} - {decision}")

    from app.routers.notifications import add_notification
    add_notification(
        title=f"Reclamation {decision.capitalize()}",
        message=f"{user.name} {decision} {student.name}'s justification.",
        type="success" if decision == "approved" else "warning",
    )

    return {"message": f"Reclamation {decision}.", "status": decision}
