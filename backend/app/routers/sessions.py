import os
import uuid

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.config import settings
from app.models import User, Student, Module, Session, AttendanceRecord
from app.schemas import SessionCreateResponse, SessionResponse, SessionAttendanceResponse, AttendanceEntry
from app.auth import require_professor, get_current_user
from app.workers.video_worker import process_video_task

router = APIRouter()


# --- IMPORTANT: Static routes MUST come before dynamic /{param} routes ---

@router.get("/next-week/{module_id}")
async def get_next_week(
    module_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the next available week number for a module."""
    last_week_q = await db.execute(
        select(func.max(Session.week_number))
        .where(Session.module_id == module_id)
        .where(Session.status == "completed")
    )
    last_week = last_week_q.scalar() or 0
    return {"next_week": last_week + 1, "last_completed_week": last_week}


@router.post("/identify", response_model=SessionCreateResponse, status_code=202)
async def identify_from_video(
    background_tasks: BackgroundTasks,
    module_id: str = Form(...),
    week_number: int = Form(...),
    video: UploadFile = File(...),
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video for attendance. Professors can only access their own module."""

    # Validate module exists
    mod_result = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    # Enforce module ownership (unless admin)
    if user.role != "admin" and str(user.module_id) != module_id:
        raise HTTPException(status_code=403, detail="You can only take attendance for your own module.")

    # Enforce sequential week numbers
    last_week_q = await db.execute(
        select(func.max(Session.week_number))
        .where(Session.module_id == module_id)
        .where(Session.status == "completed")
    )
    last_week = last_week_q.scalar() or 0

    # Allow retaking any completed week or the next one
    if week_number > last_week + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot skip to week {week_number}. Next available week is {last_week + 1}.",
        )

    if not video.content_type or not any(t in video.content_type for t in ["video", "octet-stream"]):
        raise HTTPException(status_code=400, detail="Please upload a valid video file.")

    # Save video to disk
    video_id = str(uuid.uuid4())
    ext = "webm" if "webm" in (video.content_type or "") else "mp4"
    video_filename = f"{video_id}.{ext}"
    video_path = os.path.join(settings.upload_dir, video_filename)

    content = await video.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video file exceeds 200MB limit.")

    with open(video_path, "wb") as f:
        f.write(content)

    # If retaking a week, delete old session and attendance for that week
    existing_session_q = await db.execute(
        select(Session)
        .where(Session.module_id == module_id)
        .where(Session.week_number == week_number)
    )
    existing_session = existing_session_q.scalar_one_or_none()
    if existing_session:
        await db.execute(
            delete(AttendanceRecord).where(AttendanceRecord.session_id == existing_session.id)
        )
        await db.delete(existing_session)
        await db.flush()

    # Create session record
    session = Session(
        module_id=module_id,
        week_number=week_number,
        status="processing",
        video_filename=video_filename,
    )
    db.add(session)
    await db.flush()

    session_id = str(session.id)

    # Dispatch background task
    background_tasks.add_task(process_video_task, session_id, video_path)

    return SessionCreateResponse(
        session_id=session.id,
        module_id=module.id,
        week_number=week_number,
        status="processing",
        ws_url=f"/ws/session/{session_id}",
    )


@router.get("/")
async def list_sessions(
    module_id: str = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List sessions. Professors see only their module, admin sees all."""
    query = select(Session).order_by(Session.created_at.desc())

    if user.role != "admin":
        query = query.where(Session.module_id == user.module_id)
    elif module_id:
        query = query.where(Session.module_id == module_id)

    result = await db.execute(query)
    sessions = result.scalars().all()

    responses = []
    for s in sessions:
        mod_result = await db.execute(select(Module).where(Module.id == s.module_id))
        module = mod_result.scalar_one_or_none()

        present_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.session_id == s.id)
            .where(AttendanceRecord.is_present == True)
        )
        present_count = present_q.scalar() or 0

        absent_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.session_id == s.id)
            .where(AttendanceRecord.is_present == False)
        )
        absent_count = absent_q.scalar() or 0

        responses.append(SessionResponse(
            id=s.id,
            module_id=s.module_id,
            module_name=module.name if module else None,
            module_code=module.code if module else None,
            week_number=s.week_number,
            status=s.status,
            session_date=s.session_date,
            present_count=present_count,
            absent_count=absent_count,
        ))

    return responses


@router.get("/{session_id}/attendance")
async def get_session_attendance(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full attendance list for a session."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Enforce access
    if user.role != "admin" and str(user.module_id) != str(session.module_id):
        raise HTTPException(status_code=403, detail="Access denied.")

    mod_result = await db.execute(select(Module).where(Module.id == session.module_id))
    module = mod_result.scalar_one_or_none()

    att_result = await db.execute(
        select(AttendanceRecord, Student)
        .join(Student, AttendanceRecord.student_ref == Student.id)
        .where(AttendanceRecord.session_id == session_id)
        .order_by(Student.name)
    )
    records = att_result.all()

    attendance = [
        AttendanceEntry(
            student_id=student.student_id,
            name=student.name,
            profile_image=student.profile_image,
            is_present=record.is_present,
            confidence=record.confidence,
        )
        for record, student in records
    ]

    present_count = sum(1 for a in attendance if a.is_present)

    return SessionAttendanceResponse(
        session_id=session.id,
        module_name=module.name if module else "Unknown",
        week_number=session.week_number,
        status=session.status,
        total_students=len(attendance),
        present_count=present_count,
        absent_count=len(attendance) - present_count,
        attendance=attendance,
    )
