import base64
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, Student, FaceEmbedding, AttendanceRecord, Module, Session
from app.schemas import StudentEnrollResponse, StudentProfile, StudentAttendanceDetail
from app.services.face_detection import load_image
from app.services.face_engine import extract_embedding_fast
from app.auth import require_admin, get_current_user

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.post("/enroll", response_model=StudentEnrollResponse, status_code=201)
async def enroll_student(
    name: str = Form(...),
    student_id: str = Form(...),
    email: str = Form(None),
    profile_index: int = Form(0),
    images: list[UploadFile] = File(...),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enroll a student (admin only)."""

    if len(images) < 3 or len(images) > 10:
        raise HTTPException(status_code=400, detail="Please upload between 3 and 10 images.")

    for img in images:
        if img.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {img.content_type}. Accepted: JPEG, PNG.",
            )

    existing = await db.execute(select(Student).where(Student.student_id == student_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Student ID '{student_id}' is already enrolled.")

    if profile_index < 0 or profile_index >= len(images):
        profile_index = 0

    embeddings = []
    profile_image_b64 = None

    for i, img in enumerate(images):
        image_bytes = await img.read()

        if i == profile_index:
            profile_image_b64 = f"data:{img.content_type};base64,{base64.b64encode(image_bytes).decode()}"

        try:
            img_array = load_image(image_bytes)
            embedding = extract_embedding_fast(img_array)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Image {i + 1}: Could not detect a face. Try a clearer photo.")

        embeddings.append(embedding)

    # Save to database
    student = Student(
        name=name,
        student_id=student_id,
        email=email,
        profile_image=profile_image_b64,
    )
    db.add(student)
    await db.flush()

    # Store EACH embedding individually (better matching than averaging)
    for emb in embeddings:
        face_record = FaceEmbedding(
            student_ref=student.id,
            embedding=emb.tolist(),
        )
        db.add(face_record)
    await db.flush()

    from app.routers.audit import log_action
    log_action(user.name, "enrolled_student", student.student_id, f"Enrolled {student.name} with {len(embeddings)} photos")

    return StudentEnrollResponse(
        id=student.id,
        student_id=student.student_id,
        name=student.name,
        email=student.email,
        profile_image=student.profile_image,
        enrolled_at=student.created_at,
    )


@router.get("/", response_model=list[StudentProfile])
async def list_students(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all enrolled students with attendance rates."""
    result = await db.execute(select(Student).order_by(Student.name))
    students = result.scalars().all()

    profiles = []
    for s in students:
        total = await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_ref == s.id)
        )
        total_count = total.scalar() or 0

        present = await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_ref == s.id)
            .where(AttendanceRecord.is_present == True)
        )
        present_count = present.scalar() or 0

        rate = (present_count / total_count * 100) if total_count > 0 else 0.0

        profiles.append(StudentProfile(
            id=s.id,
            student_id=s.student_id,
            name=s.name,
            email=s.email,
            profile_image=s.profile_image,
            created_at=s.created_at,
            attendance_rate=round(rate, 1),
        ))

    return profiles


@router.get("/{student_id}", response_model=StudentProfile)
async def get_student(
    student_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a student profile."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    total = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
    )
    total_count = total.scalar() or 0

    present = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
        .where(AttendanceRecord.is_present == True)
    )
    present_count = present.scalar() or 0

    rate = (present_count / total_count * 100) if total_count > 0 else 0.0

    return StudentProfile(
        id=student.id,
        student_id=student.student_id,
        name=student.name,
        email=student.email,
        profile_image=student.profile_image,
        created_at=student.created_at,
        attendance_rate=round(rate, 1),
    )


@router.get("/{student_id}/attendance", response_model=list[StudentAttendanceDetail])
async def get_student_attendance(
    student_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get per-module attendance breakdown for a student."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    modules_result = await db.execute(select(Module).order_by(Module.name))
    modules = modules_result.scalars().all()

    details = []
    for module in modules:
        total_q = await db.execute(
            select(func.count(Session.id)).where(Session.module_id == module.id)
            .where(Session.status == "completed")
        )
        total_sessions = total_q.scalar() or 0

        attended_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
            .where(AttendanceRecord.is_present == True)
        )
        attended = attended_q.scalar() or 0

        rate = (attended / total_sessions * 100) if total_sessions > 0 else 0.0

        details.append(StudentAttendanceDetail(
            module_code=module.code,
            module_name=module.name,
            total_sessions=total_sessions,
            attended=attended,
            rate=round(rate, 1),
        ))

    return details


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a student (admin only)."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    await db.delete(student)
    await db.flush()


@router.patch("/{student_id}")
async def update_student(
    student_id: str,
    name: str = Form(None),
    email: str = Form(None),
    new_student_id: str = Form(None),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update student info (admin only)."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if name is not None and name.strip():
        student.name = name.strip()
    if email is not None:
        student.email = email.strip() if email.strip() else None
    if new_student_id is not None and new_student_id.strip():
        # Check for duplicate
        if new_student_id.strip() != student.student_id:
            existing = await db.execute(select(Student).where(Student.student_id == new_student_id.strip()))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=409, detail=f"Student ID '{new_student_id}' already exists.")
            student.student_id = new_student_id.strip()

    await db.flush()

    return {
        "id": str(student.id),
        "student_id": student.student_id,
        "name": student.name,
        "email": student.email,
        "message": "Student updated successfully.",
    }
