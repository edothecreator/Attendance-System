"""
PDF Report Generation for official university documents.
"""
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image

from app.database import get_db
from app.models import User, Student, Module, Session, AttendanceRecord
from app.auth import get_current_user

router = APIRouter()


@router.get("/student/{student_id}")
async def generate_student_report(
    student_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF attendance report for a single student."""
    student_q = await db.execute(select(Student).where(Student.student_id == student_id))
    student = student_q.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    modules_q = await db.execute(select(Module).order_by(Module.code))
    modules = modules_q.scalars().all()

    # Build report data
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=16, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.grey)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=12, spaceBefore=20)

    elements = []

    # Header
    elements.append(Paragraph("Université Cadi Ayyad", subtitle_style))
    elements.append(Paragraph("Faculté des Sciences et Techniques — Marrakech", subtitle_style))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("RELEVÉ D'ASSIDUITÉ", title_style))
    elements.append(Spacer(1, 0.3*cm))

    # Student info
    info_data = [
        ["Nom Complet:", student.name],
        ["CNE / Apogée:", student.student_id],
        ["Email:", student.email or "—"],
        ["Date:", datetime.now().strftime("%d/%m/%Y")],
    ]
    info_table = Table(info_data, colWidths=[4*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Per-module attendance table
    elements.append(Paragraph("Détail par Module", heading_style))

    table_data = [["Module", "Code", "Séances", "Présences", "Absences", "Taux (%)"]]

    total_sessions_all = 0
    total_present_all = 0

    for module in modules:
        total_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
        )
        total = total_q.scalar() or 0

        present_q = await db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Session, AttendanceRecord.session_id == Session.id)
            .where(Session.module_id == module.id)
            .where(AttendanceRecord.student_ref == student.id)
            .where(AttendanceRecord.is_present == True)
        )
        present = present_q.scalar() or 0

        absences = total - present
        rate = (present / total * 100) if total > 0 else 0

        total_sessions_all += total
        total_present_all += present

        table_data.append([
            module.name[:25],
            module.code,
            str(total),
            str(present),
            str(absences),
            f"{rate:.1f}",
        ])

    # Total row
    overall_rate = (total_present_all / total_sessions_all * 100) if total_sessions_all > 0 else 0
    table_data.append([
        "TOTAL", "", str(total_sessions_all), str(total_present_all),
        str(total_sessions_all - total_present_all), f"{overall_rate:.1f}"
    ])

    table = Table(table_data, colWidths=[5.5*cm, 2*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(table)

    # Footer
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph("_" * 40, styles['Normal']))
    elements.append(Paragraph("Signature & Cachet de l'Administration", subtitle_style))

    doc.build(elements)
    buf.seek(0)

    filename = f"releve_assiduite_{student.student_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/module/{module_id}")
async def generate_module_report(
    module_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF attendance report for an entire module (all students)."""
    module_q = await db.execute(select(Module).where(Module.id == module_id))
    module = module_q.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    students_q = await db.execute(select(Student).order_by(Student.name))
    students = students_q.scalars().all()

    sessions_q = await db.execute(
        select(Session).where(Session.module_id == module.id)
        .where(Session.status == "completed").order_by(Session.week_number)
    )
    sessions = sessions_q.scalars().all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=1*cm, rightMargin=1*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=14, spaceAfter=4)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=9, textColor=colors.grey)

    elements = []

    elements.append(Paragraph("Université Cadi Ayyad — FST Marrakech", subtitle_style))
    elements.append(Paragraph(f"FEUILLE D'ÉMARGEMENT — {module.code}: {module.name}", title_style))
    elements.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 0.5*cm))

    # Build table: Student | S1 | S2 | ... | Total | Rate
    header = ["CNE", "Nom"]
    for s in sessions:
        header.append(f"S{s.week_number}")
    header.extend(["Abs.", "%"])

    table_data = [header]

    for student in students:
        row = [student.student_id, student.name[:20]]
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
                row.append("—")

        rate = ((total - absences) / total * 100) if total > 0 else 0
        row.extend([str(absences), f"{rate:.0f}"])
        table_data.append(row)

    # Calculate column widths
    n_sessions = len(sessions)
    name_width = 3.5*cm
    cne_width = 2.5*cm
    session_width = 1*cm
    end_widths = [1.2*cm, 1.2*cm]
    col_widths = [cne_width, name_width] + [session_width] * n_sessions + end_widths

    table = Table(table_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    elements.append(table)

    elements.append(Spacer(1, 1.5*cm))
    elements.append(Paragraph("Signature du Professeur: _________________________", styles['Normal']))

    doc.build(elements)
    buf.seek(0)

    filename = f"emargement_{module.code}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/certificate/{student_id}")
async def generate_attendance_certificate(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate an official attendance certificate PDF for a student."""
    student_q = await db.execute(select(Student).where(Student.student_id == student_id))
    student = student_q.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Calculate overall attendance
    total_q = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
    )
    total = total_q.scalar() or 0

    present_q = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_ref == student.id)
        .where(AttendanceRecord.is_present == True)
    )
    present = present_q.scalar() or 0

    rate = (present / total * 100) if total > 0 else 0

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=3*cm, bottomMargin=3*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('CertTitle', parent=styles['Title'], fontSize=20, spaceAfter=10, alignment=1)
    subtitle_style = ParagraphStyle('CertSub', parent=styles['Normal'], fontSize=11, textColor=colors.grey, alignment=1)
    body_style = ParagraphStyle('CertBody', parent=styles['Normal'], fontSize=12, leading=20, alignment=1)
    bold_style = ParagraphStyle('CertBold', parent=styles['Normal'], fontSize=12, leading=20, alignment=1, fontName='Helvetica-Bold')

    elements = []

    # Header
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("UNIVERSITÉ CADI AYYAD", subtitle_style))
    elements.append(Paragraph("Faculté des Sciences et Techniques — Marrakech", subtitle_style))
    elements.append(Spacer(1, 1.5*cm))

    # Title
    elements.append(Paragraph("ATTESTATION D'ASSIDUITÉ", title_style))
    elements.append(Spacer(1, 1*cm))

    # Body
    elements.append(Paragraph(
        f"Le Doyen de la Faculté des Sciences et Techniques de Marrakech atteste que :",
        body_style
    ))
    elements.append(Spacer(1, 0.8*cm))

    elements.append(Paragraph(f"<b>{student.name}</b>", bold_style))
    elements.append(Paragraph(f"CNE / Apogée : <b>{student.student_id}</b>", body_style))
    if student.email:
        elements.append(Paragraph(f"Email : {student.email}", body_style))
    elements.append(Spacer(1, 0.8*cm))

    elements.append(Paragraph(
        f"A suivi les enseignements avec un taux de présence global de :",
        body_style
    ))
    elements.append(Spacer(1, 0.5*cm))

    # Big rate
    rate_style = ParagraphStyle('Rate', parent=styles['Title'], fontSize=36, alignment=1,
                                 textColor=colors.HexColor('#0ea5e9') if rate >= 75 else colors.HexColor('#e11d48'))
    elements.append(Paragraph(f"{rate:.1f} %", rate_style))
    elements.append(Paragraph(f"({present} présences sur {total} séances enregistrées)", subtitle_style))
    elements.append(Spacer(1, 1.5*cm))

    elements.append(Paragraph(
        f"Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
        body_style
    ))
    elements.append(Spacer(1, 1*cm))

    elements.append(Paragraph(
        f"Fait à Marrakech, le {datetime.now().strftime('%d/%m/%Y')}",
        body_style
    ))
    elements.append(Spacer(1, 2*cm))

    # Signature area
    sig_style = ParagraphStyle('Sig', parent=styles['Normal'], fontSize=10, alignment=2)
    elements.append(Paragraph("Le Doyen", sig_style))
    elements.append(Spacer(1, 1.5*cm))
    elements.append(Paragraph("_________________________", sig_style))
    elements.append(Paragraph("Signature & Cachet", sig_style))

    # Footer
    elements.append(Spacer(1, 1*cm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    elements.append(Paragraph("Document généré automatiquement par AttendAI — Système de Gestion d'Assiduité par Reconnaissance Faciale", footer_style))

    doc.build(elements)
    buf.seek(0)

    filename = f"attestation_assiduite_{student.student_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
