from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Student, FaceEmbedding, Session, AttendanceRecord
from app.services.video_processor import extract_frames, get_video_info
from app.services.identification import find_best_match
from app.routers.websocket import ws_manager as manager
import numpy as np


async def process_video_task(session_id: str, video_path: str):
    """
    Robust video processing pipeline for attendance.

    Strategy for maximum detection:
    1. Extract frames at 2 FPS (more chances to catch faces)
    2. Try multiple detector backends per frame (fallback chain)
    3. Track all detections across frames, keep best confidence per person
    4. Use lenient thresholds since video quality is lower than photos
    """
    from deepface import DeepFace

    async with async_session() as db:
        try:
            await _update_session_status(db, session_id, "extracting_frames")
            await manager.send_status(session_id, "extracting_frames", 0)

            # Load all stored embeddings
            stored_embeddings = await _load_all_embeddings(db)
            all_students = await _load_all_students(db)

            if not stored_embeddings:
                await _update_session_status(db, session_id, "completed")
                await manager.send_complete(session_id, 0, 0)
                await db.commit()
                return

            # Get video info
            video_info = get_video_info(video_path)
            total_expected_frames = max(int(video_info["duration_sec"] * 2), 1)  # 2 FPS

            # Track detections
            detected_students: dict[str, dict] = {}
            frame_count = 0

            await manager.send_status(session_id, "detecting_faces", 10)

            # Extract at 2 FPS for more coverage
            for frame_num, timestamp, frame in extract_frames(video_path, fps=2):
                frame_count += 1
                progress = min(90, int((frame_count / total_expected_frames) * 80) + 10)
                await manager.send_status(session_id, "identifying", progress)

                # Try to get embeddings from this frame using fallback detectors
                face_embeddings = _extract_faces_from_frame(DeepFace, frame)

                for embedding in face_embeddings:
                    match = find_best_match(embedding, stored_embeddings)
                    if match:
                        ref = match["student_ref"]
                        if ref not in detected_students or match["confidence"] > detected_students[ref]["confidence"]:
                            detected_students[ref] = {
                                **match,
                                "frame_number": frame_num,
                                "timestamp_sec": timestamp,
                            }
                            await manager.send_match(
                                session_id,
                                match["name"],
                                match["student_id"],
                                match["confidence"],
                            )

            # Create attendance records for ALL students
            for student in all_students:
                s_ref = str(student["id"])
                if s_ref in detected_students:
                    record = AttendanceRecord(
                        session_id=session_id,
                        student_ref=student["id"],
                        is_present=True,
                        confidence=detected_students[s_ref]["confidence"],
                        detected_at_sec=detected_students[s_ref]["timestamp_sec"],
                    )
                else:
                    record = AttendanceRecord(
                        session_id=session_id,
                        student_ref=student["id"],
                        is_present=False,
                        confidence=None,
                        detected_at_sec=None,
                    )
                db.add(record)

            await _update_session_status(db, session_id, "completed")
            await db.commit()
            await manager.send_complete(session_id, len(detected_students), frame_count)

            # Fire notification
            from app.routers.notifications import add_notification
            add_notification(
                title="Session Completed",
                message=f"{len(detected_students)} student(s) identified, {len(all_students) - len(detected_students)} absent.",
                type="success",
            )

            # Check for absence warnings and send emails
            await _check_and_send_absence_alerts(db, session_id)

        except Exception as e:
            await _update_session_status(db, session_id, f"failed: {str(e)[:100]}")
            await db.commit()
            await manager.send_status(session_id, "error", 0)


def _extract_faces_from_frame(DeepFace, frame: np.ndarray) -> list[np.ndarray]:
    """
    Extract face embeddings from a video frame.
    Uses only MTCNN (most accurate) — no fallback to weaker detectors
    that produce false positives.
    """
    try:
        results = DeepFace.represent(
            img_path=frame,
            model_name="Facenet512",
            enforce_detection=False,
            detector_backend="mtcnn",
        )
        embeddings = []
        for r in results:
            # Filter: face must be reasonably sized (at least 50x50 pixels)
            area = r.get("facial_area", {})
            w = area.get("w", 0)
            h = area.get("h", 0)
            if w >= 50 and h >= 50:
                embeddings.append(np.array(r["embedding"]))
        return embeddings
    except Exception:
        return []


async def _update_session_status(db: AsyncSession, session_id: str, status: str):
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.status = status
        if status == "completed":
            session.completed_at = datetime.utcnow()
        await db.flush()


async def _load_all_embeddings(db: AsyncSession) -> list[dict]:
    """Load all stored embeddings with student info. Multiple per student."""
    result = await db.execute(
        select(FaceEmbedding, Student).join(Student, FaceEmbedding.student_ref == Student.id)
    )
    rows = result.all()
    return [
        {
            "student_id": student.student_id,
            "name": student.name,
            "student_ref": str(student.id),
            "embedding": embedding.embedding,
        }
        for embedding, student in rows
    ]


async def _load_all_students(db: AsyncSession) -> list[dict]:
    """Load all students."""
    result = await db.execute(select(Student))
    students = result.scalars().all()
    return [{"id": s.id, "student_id": s.student_id, "name": s.name} for s in students]


async def _check_and_send_absence_alerts(db: AsyncSession, session_id: str):
    """
    After attendance is recorded, check if any student just hit 2+ absences
    in this module. If so, send them a warning email.
    """
    from app.models import Module, User
    from app.services.email_service import send_absence_warning
    from sqlalchemy import func

    # Get the session's module
    session_q = await db.execute(select(Session).where(Session.id == session_id))
    session = session_q.scalar_one_or_none()
    if not session:
        return

    module_q = await db.execute(select(Module).where(Module.id == session.module_id))
    module = module_q.scalar_one_or_none()
    if not module:
        return

    # Get professor name for this module
    prof_q = await db.execute(select(User).where(User.module_id == module.id))
    prof = prof_q.scalar_one_or_none()
    professor_name = prof.name if prof else "Your Professor"

    # Find students marked absent in THIS session
    absent_q = await db.execute(
        select(AttendanceRecord, Student)
        .join(Student, AttendanceRecord.student_ref == Student.id)
        .where(AttendanceRecord.session_id == session_id)
        .where(AttendanceRecord.is_present == False)
    )
    absent_records = absent_q.all()

    for record, student in absent_records:
        # Count total absences for this student in this module
        total_absences_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
            .where(AttendanceRecord.is_present == False)
        )
        total_absences = total_absences_q.scalar() or 0

        # Send warning at exactly 2 absences (first warning)
        # and again at 3 (critical warning)
        if total_absences in (2, 3):
            from app.routers.notifications import add_notification
            send_absence_warning(
                student_name=student.name,
                student_email=student.email,
                module_name=module.name,
                module_code=module.code,
                professor_name=professor_name,
                absence_count=total_absences,
            )
            add_notification(
                title="Absence Alert Sent",
                message=f"Email sent to {student.name} ({student.email or 'no email'}) — {total_absences} absences in {module.code}.",
                type="warning",
            )
