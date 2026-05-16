"""
QR Code Fallback Attendance.
Generates a unique, time-limited QR code per session.
Students who weren't detected by AI can scan it to mark themselves present.
QR codes expire after 10 minutes and are single-use per student.
"""
import uuid
import time
import io
import base64

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Student, Session, AttendanceRecord, Module
from app.auth import get_current_user, require_professor

router = APIRouter()

# In-memory store for active QR tokens (in production, use Redis)
# Format: { token: { session_id, module_id, created_at, expires_at } }
active_qr_tokens: dict[str, dict] = {}

QR_EXPIRY_SECONDS = 600  # 10 minutes


@router.post("/generate/{session_id}")
async def generate_qr_code(
    session_id: str,
    latitude: float = Form(...),
    longitude: float = Form(...),
    user: User = Depends(require_professor),
    db: AsyncSession = Depends(get_db),
):
    """Generate a QR code for a session. Captures professor's location as anchor."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if user.role != "admin" and str(user.module_id) != str(session.module_id):
        raise HTTPException(status_code=403, detail="Access denied.")

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session must be completed before generating QR.")

    # Generate unique token
    token = str(uuid.uuid4())
    now = time.time()

    active_qr_tokens[token] = {
        "session_id": session_id,
        "module_id": str(session.module_id),
        "created_at": now,
        "expires_at": now + QR_EXPIRY_SECONDS,
        "used_by": [],
        "latitude": latitude,
        "longitude": longitude,
    }

    # Generate QR code image as base64
    # QR contains a URL that opens the student portal with token pre-filled
    base_url = "https://172.20.10.2:5173"
    qr_data = f"{base_url}/portal?token={token}"

    img = qrcode.make(qr_data, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode()

    from app.routers.audit import log_action
    log_action(user.name, "generated_qr", session_id, f"QR code for session {session_id[:8]}")

    return {
        "token": token,
        "qr_image": f"data:image/png;base64,{qr_base64}",
        "qr_data": qr_data,
        "expires_in": QR_EXPIRY_SECONDS,
        "expires_at": now + QR_EXPIRY_SECONDS,
    }


@router.post("/checkin")
async def qr_checkin(
    token: str = Form(...),
    student_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Student checks in via QR code. Verifies they are within 50m of the classroom."""
    import math

    # Validate token
    if token not in active_qr_tokens:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code.")

    qr_info = active_qr_tokens[token]

    # Check expiry
    if time.time() > qr_info["expires_at"]:
        del active_qr_tokens[token]
        raise HTTPException(status_code=400, detail="QR code has expired.")

    # Verify location (must be within 50 meters of professor's location)
    # Skip geo-check if professor didn't provide location (0,0)
    if qr_info["latitude"] != 0 and qr_info["longitude"] != 0:
        MAX_DISTANCE_METERS = 50

        if latitude == 0 and longitude == 0:
            raise HTTPException(
                status_code=403,
                detail="Location is required for check-in. Please allow location access.",
            )

        distance = _haversine_distance(
            qr_info["latitude"], qr_info["longitude"],
            latitude, longitude,
        )

        if distance > MAX_DISTANCE_METERS:
            raise HTTPException(
                status_code=403,
                detail=f"You are too far from the classroom ({int(distance)}m away). You must be within {MAX_DISTANCE_METERS}m to check in.",
            )

    # Find student
    student_q = await db.execute(select(Student).where(Student.student_id == student_id))
    student = student_q.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found. Check your CNE.")

    # Check if already used by this student
    if str(student.id) in qr_info["used_by"]:
        raise HTTPException(status_code=400, detail="You have already checked in for this session.")

    # Find their attendance record for this session
    att_q = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.session_id == qr_info["session_id"])
        .where(AttendanceRecord.student_ref == student.id)
    )
    record = att_q.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=400, detail="No attendance record found for this session.")

    if record.is_present:
        return {"message": "You are already marked as present.", "status": "already_present"}

    # Mark as present via QR
    record.is_present = True
    record.confidence = 0.99  # QR check-in confidence
    qr_info["used_by"].append(str(student.id))
    await db.flush()
    await db.commit()

    from app.routers.audit import log_action
    log_action(student.name, "qr_checkin", qr_info["session_id"], f"{student.student_id} checked in via QR code")

    return {"message": f"Welcome, {student.name}! You are now marked as present.", "status": "checked_in"}


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    import math
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@router.get("/active/{session_id}")
async def get_active_qr(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if there's an active QR for a session."""
    for token, info in list(active_qr_tokens.items()):
        if info["session_id"] == session_id:
            if time.time() > info["expires_at"]:
                del active_qr_tokens[token]
                continue
            return {
                "active": True,
                "token": token,
                "expires_at": info["expires_at"],
                "remaining_seconds": int(info["expires_at"] - time.time()),
                "used_count": len(info["used_by"]),
            }
    return {"active": False}
