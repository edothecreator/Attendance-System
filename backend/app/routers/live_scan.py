"""
Live Scan endpoint.
Receives individual frames from the browser camera and identifies faces in real-time.
"""
import base64
import numpy as np
from io import BytesIO
from PIL import Image

from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Student, FaceEmbedding, Session, AttendanceRecord, Module
from app.auth import require_professor
from app.services.face_engine import FastMatcher, extract_faces_from_frame_fast
from app.config import settings

router = APIRouter()

# In-memory session state for live scans
live_sessions: dict[str, dict] = {}


@router.post("/start")
async def start_live_scan(
    module_id: str = Form(...),
    week_number: int = Form(...),
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Start a live scan session. Returns a scan_id to use for frame submissions."""
    import uuid
    from sqlalchemy import func

    # Validate module
    mod_q = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_q.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    if user.role != "admin" and str(user.module_id) != module_id:
        raise HTTPException(status_code=403, detail="You can only scan for your own module.")

    # Sequential week check
    last_week_q = await db.execute(
        select(func.max(Session.week_number))
        .where(Session.module_id == module_id)
        .where(Session.status == "completed")
    )
    last_week = last_week_q.scalar() or 0
    if week_number > last_week + 1:
        raise HTTPException(status_code=400, detail=f"Cannot skip to week {week_number}.")

    # Load embeddings and build matcher
    emb_q = await db.execute(
        select(FaceEmbedding, Student).join(Student, FaceEmbedding.student_ref == Student.id)
    )
    stored = [
        {"student_id": s.student_id, "name": s.name, "student_ref": str(s.id), "embedding": e.embedding}
        for e, s in emb_q.all()
    ]

    matcher = FastMatcher(stored, threshold=settings.face_match_threshold)

    scan_id = str(uuid.uuid4())
    live_sessions[scan_id] = {
        "module_id": module_id,
        "week_number": week_number,
        "matcher": matcher,
        "detections": {},  # student_ref -> {count, best_confidence, name, student_id}
        "frame_count": 0,
    }

    return {"scan_id": scan_id, "total_enrolled": len(stored)}


@router.post("/frame")
async def process_frame(
    scan_id: str = Form(...),
    frame_data: str = Form(...),
):
    """Process a single frame. Optimized for speed."""
    if scan_id not in live_sessions:
        return {"new_matches": [], "confirmed_count": 0, "frame_count": 0, "expired": True}

    session = live_sessions[scan_id]
    session["frame_count"] += 1

    # Decode base64 frame
    try:
        if "," in frame_data:
            frame_data = frame_data.split(",")[1]
        img_bytes = base64.b64decode(frame_data)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        frame = np.array(img)
    except Exception:
        return {"new_matches": [], "confirmed_count": len([d for d in session["detections"].values() if d["count"] >= 2]), "frame_count": session["frame_count"]}

    # Extract faces and match
    embeddings = extract_faces_from_frame_fast(frame)
    new_matches = []

    for embedding in embeddings:
        match = session["matcher"].find_match(embedding)
        if match:
            ref = match["student_ref"]
            if ref not in session["detections"]:
                session["detections"][ref] = {
                    "count": 0,
                    "best_confidence": 0,
                    "name": match["name"],
                    "student_id": match["student_id"],
                    "student_ref": ref,
                }
            session["detections"][ref]["count"] += 1
            if match["confidence"] > session["detections"][ref]["best_confidence"]:
                session["detections"][ref]["best_confidence"] = match["confidence"]

            # Report as confirmed after 2+ detections
            if session["detections"][ref]["count"] == 2:
                new_matches.append({
                    "name": match["name"],
                    "student_id": match["student_id"],
                    "confidence": session["detections"][ref]["best_confidence"],
                })

    confirmed = len([d for d in session["detections"].values() if d["count"] >= 2])

    return {
        "new_matches": new_matches,
        "confirmed_count": confirmed,
        "frame_count": session["frame_count"],
    }


@router.post("/finish")
async def finish_live_scan(
    scan_id: str = Form(...),
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Finish the live scan and save attendance records."""
    from sqlalchemy import delete

    if scan_id not in live_sessions:
        raise HTTPException(status_code=400, detail="Invalid scan session.")

    session_data = live_sessions.pop(scan_id)  # Remove immediately
    module_id = session_data["module_id"]
    week_number = session_data["week_number"]

    # Delete existing session for this week if retaking
    existing_q = await db.execute(
        select(Session).where(Session.module_id == module_id).where(Session.week_number == week_number)
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        await db.execute(delete(AttendanceRecord).where(AttendanceRecord.session_id == existing.id))
        await db.execute(delete(Session).where(Session.id == existing.id))

    # Create session
    new_session = Session(
        module_id=module_id,
        week_number=week_number,
        status="completed",
        video_filename="live_scan",
    )
    db.add(new_session)
    await db.flush()

    # Get confirmed students (2+ detections)
    confirmed_refs = set(
        ref for ref, d in session_data["detections"].items() if d["count"] >= 2
    )

    # Batch create all attendance records at once
    all_students_q = await db.execute(select(Student))
    all_students = all_students_q.scalars().all()

    present_count = 0
    for student in all_students:
        s_ref = str(student.id)
        is_present = s_ref in confirmed_refs
        confidence = session_data["detections"][s_ref]["best_confidence"] if is_present else None
        if is_present:
            present_count += 1
        db.add(AttendanceRecord(
            session_id=new_session.id,
            student_ref=student.id,
            is_present=is_present,
            confidence=confidence,
            detected_at_sec=None,
        ))

    await db.commit()

    # Notification (non-blocking)
    try:
        from app.routers.notifications import add_notification
        add_notification(
            title="Live Scan Completed",
            message=f"{present_count} student(s) identified via live scan.",
            type="success",
            for_module=module_id,
        )
    except Exception:
        pass

    return {
        "message": "Attendance saved.",
        "present_count": present_count,
        "absent_count": len(all_students) - present_count,
        "session_id": str(new_session.id),
    }
