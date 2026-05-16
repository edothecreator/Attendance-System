from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models import User, Student, Module, Session, AttendanceRecord
from app.auth import get_current_user

router = APIRouter()


@router.get("/heatmap")
async def get_attendance_heatmap(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a matrix: modules × weeks with attendance rates.
    Each cell = { present_count, absent_count, rate }
    """
    modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    total_students_q = await db.execute(select(func.count(Student.id)))
    total_students = total_students_q.scalar() or 0

    heatmap = []
    for module in modules:
        module_data = {
            "module_id": str(module.id),
            "module_code": module.code,
            "module_name": module.name,
            "weeks": [],
        }

        for week in range(1, module.total_weeks + 1):
            session_q = await db.execute(
                select(Session)
                .where(Session.module_id == module.id)
                .where(Session.week_number == week)
                .where(Session.status == "completed")
            )
            session = session_q.scalar_one_or_none()

            if session:
                present_q = await db.execute(
                    select(func.count(AttendanceRecord.id))
                    .where(AttendanceRecord.session_id == session.id)
                    .where(AttendanceRecord.is_present == True)
                )
                present = present_q.scalar() or 0

                absent_q = await db.execute(
                    select(func.count(AttendanceRecord.id))
                    .where(AttendanceRecord.session_id == session.id)
                    .where(AttendanceRecord.is_present == False)
                )
                absent = absent_q.scalar() or 0

                total = present + absent
                rate = (present / total * 100) if total > 0 else 0

                module_data["weeks"].append({
                    "week": week,
                    "present": present,
                    "absent": absent,
                    "rate": round(rate, 1),
                    "completed": True,
                })
            else:
                module_data["weeks"].append({
                    "week": week,
                    "present": 0,
                    "absent": 0,
                    "rate": 0,
                    "completed": False,
                })

        heatmap.append(module_data)

    return {"heatmap": heatmap, "total_students": total_students}


@router.get("/at-risk")
async def get_at_risk_students(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Flag students approaching exclusion threshold.
    Moroccan university rule: >3 unjustified absences in a module = exclusion risk.
    Returns students with 2+ absences in any module.
    """
    students_q = await db.execute(select(Student).order_by(Student.name))
    students = students_q.scalars().all()

    modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    at_risk = []

    for student in students:
        student_risk = {
            "id": str(student.id),
            "student_id": student.student_id,
            "name": student.name,
            "profile_image": student.profile_image,
            "modules_at_risk": [],
            "total_absences": 0,
            "risk_level": "safe",  # safe, warning, critical
        }

        max_absences = 0

        for module in modules:
            # Count absences for this student in this module
            absence_q = await db.execute(
                select(func.count(AttendanceRecord.id))
                .join(Session, AttendanceRecord.session_id == Session.id)
                .where(Session.module_id == module.id)
                .where(AttendanceRecord.student_ref == student.id)
                .where(AttendanceRecord.is_present == False)
            )
            absences = absence_q.scalar() or 0

            # Count total sessions for this module
            total_q = await db.execute(
                select(func.count(AttendanceRecord.id))
                .join(Session, AttendanceRecord.session_id == Session.id)
                .where(Session.module_id == module.id)
                .where(AttendanceRecord.student_ref == student.id)
            )
            total = total_q.scalar() or 0

            if absences >= 2:
                student_risk["modules_at_risk"].append({
                    "module_code": module.code,
                    "module_name": module.name,
                    "absences": absences,
                    "total_sessions": total,
                })

            student_risk["total_absences"] += absences
            max_absences = max(max_absences, absences)

        # Determine risk level
        if max_absences >= 4:
            student_risk["risk_level"] = "critical"
        elif max_absences >= 3:
            student_risk["risk_level"] = "warning"
        elif max_absences >= 2:
            student_risk["risk_level"] = "caution"

        if student_risk["modules_at_risk"]:
            at_risk.append(student_risk)

    # Sort by risk level (critical first)
    risk_order = {"critical": 0, "warning": 1, "caution": 2, "safe": 3}
    at_risk.sort(key=lambda x: risk_order.get(x["risk_level"], 3))

    return {"at_risk": at_risk, "total_flagged": len(at_risk)}


@router.get("/export/csv")
async def export_attendance_csv(
    module_id: str = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export attendance data in Apogée-compatible CSV format.
    Columns: CNE, Nom, Prénom, Module, S1, S2, ..., S14, Total Absences, Taux
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io

    students_q = await db.execute(select(Student).order_by(Student.name))
    students = students_q.scalars().all()

    if module_id:
        modules_q = await db.execute(select(Module).where(Module.id == module_id))
    else:
        modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    for module in modules:
        # Header row
        header = ["CNE", "Nom Complet", "Module"]
        sessions_q = await db.execute(
            select(Session)
            .where(Session.module_id == module.id)
            .where(Session.status == "completed")
            .order_by(Session.week_number)
        )
        sessions = sessions_q.scalars().all()

        for s in sessions:
            header.append(f"S{s.week_number}")
        header.extend(["Total Absences", "Taux Présence (%)"])
        writer.writerow(header)

        # Student rows
        for student in students:
            row = [student.student_id, student.name, module.code]
            absences = 0
            total = 0

            for session in sessions:
                att_q = await db.execute(
                    select(AttendanceRecord)
                    .where(AttendanceRecord.session_id == session.id)
                    .where(AttendanceRecord.student_ref == student.id)
                )
                att = att_q.scalar_one_or_none()
                if att:
                    total += 1
                    if att.is_present:
                        row.append("P")
                    else:
                        row.append("A")
                        absences += 1
                else:
                    row.append("-")

            rate = ((total - absences) / total * 100) if total > 0 else 0
            row.extend([absences, f"{rate:.1f}"])
            writer.writerow(row)

        writer.writerow([])  # Empty row between modules

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendai_export_apogee.csv"},
    )


@router.get("/trends")
async def get_attendance_trends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get attendance trends over time (per week across all modules).
    Returns data suitable for a line chart.
    """
    modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    trends = []

    for module in modules:
        module_trend = {
            "module_code": module.code,
            "module_name": module.name,
            "data_points": [],
        }

        sessions_q = await db.execute(
            select(Session).where(Session.module_id == module.id)
            .where(Session.status == "completed")
            .order_by(Session.week_number)
        )
        sessions = sessions_q.scalars().all()

        for session in sessions:
            present_q = await db.execute(
                select(func.count(AttendanceRecord.id))
                .where(AttendanceRecord.session_id == session.id)
                .where(AttendanceRecord.is_present == True)
            )
            present = present_q.scalar() or 0

            total_q = await db.execute(
                select(func.count(AttendanceRecord.id))
                .where(AttendanceRecord.session_id == session.id)
            )
            total = total_q.scalar() or 0

            rate = (present / total * 100) if total > 0 else 0

            module_trend["data_points"].append({
                "week": session.week_number,
                "rate": round(rate, 1),
                "present": present,
                "total": total,
                "date": session.session_date.isoformat() if session.session_date else None,
            })

        if module_trend["data_points"]:
            trends.append(module_trend)

    return {"trends": trends}
