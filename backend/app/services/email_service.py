import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings


def send_absence_warning(
    student_name: str,
    student_email: str,
    module_name: str,
    module_code: str,
    professor_name: str,
    absence_count: int,
):
    """
    Send an automated absence warning email to a student.
    Called when a student hits 2+ absences in a single module.
    """
    if not student_email:
        print(f"[EMAIL] No email for {student_name} — skipping.")
        return False

    if not settings.smtp_host:
        print(f"[EMAIL] SMTP not configured — would send to {student_email}")
        print(f"        Subject: Absence Warning - {module_code}")
        return False

    subject = f"⚠️ Absence Warning — {module_code} ({module_name})"

    html_body = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
        <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #06b6d4); width: 48px; height: 48px; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">A</div>
                <h1 style="color: #0f172a; font-size: 20px; margin: 12px 0 4px 0;">AttendAI — FST Marrakech</h1>
                <p style="color: #94a3b8; font-size: 13px; margin: 0;">Automated Attendance System</p>
            </div>

            <!-- Body -->
            <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    Bonjour <strong>{student_name}</strong>,
                </p>

                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    This is an automated notification from the AttendAI system. Our records indicate that you have accumulated
                    <strong style="color: #e11d48;">{absence_count} absence(s)</strong> in the following module:
                </p>

                <!-- Module card -->
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; color: #991b1b; font-weight: 600;">
                        {module_code} — {module_name}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #b91c1c;">
                        Professor: {professor_name} · Absences: {absence_count}
                    </p>
                </div>

                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    As per FST Marrakech regulations, accumulating <strong>3 or more unjustified absences</strong> in a single module
                    may result in exclusion from the final exam for that module.
                </p>

                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    If you believe this is an error or you have a valid justification (medical certificate, etc.),
                    please contact your professor <strong>{professor_name}</strong> as soon as possible to submit your documentation.
                </p>

                <!-- CTA -->
                <div style="text-align: center; margin: 28px 0 12px 0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 16px; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                    AttendAI · Faculté des Sciences et Techniques · Université Cadi Ayyad · Marrakech
                </p>
            </div>
        </div>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = student_email

        # Plain text fallback
        plain_text = f"""
Bonjour {student_name},

Absence Warning — {module_code} ({module_name})

You have accumulated {absence_count} absence(s) in {module_code} - {module_name} (Prof. {professor_name}).

As per FST Marrakech regulations, 3+ unjustified absences may result in exam exclusion.

If you have a valid justification, please contact {professor_name} immediately.

— AttendAI, FST Marrakech
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        print(f"[EMAIL] ✓ Sent absence warning to {student_email} ({module_code}: {absence_count} absences)")
        return True

    except Exception as e:
        print(f"[EMAIL] ✗ Failed to send to {student_email}: {e}")
        return False


def send_reclamation_result_email(
    student_name: str,
    student_email: str,
    module_name: str,
    module_code: str,
    week_number: int,
    decision: str,
    professor_response: str,
    professor_name: str,
):
    """Send email to student about their reclamation result."""
    if not student_email or not settings.smtp_host:
        print(f"[EMAIL] Reclamation {decision} for {student_name} — {'sent' if settings.smtp_host else 'SMTP not configured'}")
        return False

    is_approved = decision == "approved"
    subject = f"{'✅' if is_approved else '❌'} Reclamation {decision.capitalize()} — {module_code} Week {week_number}"

    status_color = "#10B981" if is_approved else "#E11D48"
    status_text = "APPROUVÉE" if is_approved else "REFUSÉE"

    html_body = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
        <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #06b6d4); width: 48px; height: 48px; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">A</div>
                <h1 style="color: #0f172a; font-size: 18px; margin: 12px 0 4px 0;">Résultat de votre réclamation</h1>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
                <p style="color: #334155; font-size: 15px;">Bonjour <strong>{student_name}</strong>,</p>

                <p style="color: #334155; font-size: 15px;">
                    Votre réclamation pour le module <strong>{module_code} — {module_name}</strong> (Séance {week_number}) a été traitée par <strong>{professor_name}</strong>.
                </p>

                <div style="background: {'#ecfdf5' if is_approved else '#fef2f2'}; border: 1px solid {'#a7f3d0' if is_approved else '#fecaca'}; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; font-size: 18px; font-weight: bold; color: {status_color};">
                        {status_text}
                    </p>
                </div>

                {'<p style="color: #334155; font-size: 14px;"><strong>Réponse du professeur :</strong> ' + professor_response + '</p>' if professor_response else ''}

                <p style="color: #334155; font-size: 14px; margin-top: 16px;">
                    {'Votre absence a été marquée comme justifiée.' if is_approved else 'Votre absence reste non justifiée. Veuillez contacter votre professeur si vous avez des questions.'}
                </p>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px;">AttendAI · FST Marrakech</p>
            </div>
        </div>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = student_email

        plain_text = f"""
Bonjour {student_name},

Votre réclamation pour {module_code} - {module_name} (Séance {week_number}) a été {decision} par {professor_name}.

{f'Réponse: {professor_response}' if professor_response else ''}

{'Votre absence a été marquée comme justifiée.' if is_approved else 'Votre absence reste non justifiée.'}

— AttendAI, FST Marrakech
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        print(f"[EMAIL] ✓ Reclamation result sent to {student_email} ({decision})")
        return True
    except Exception as e:
        print(f"[EMAIL] ✗ Failed: {e}")
        return False


def send_reclamation_notification_to_prof(
    professor_email: str,
    professor_name: str,
    student_name: str,
    student_id: str,
    module_name: str,
    module_code: str,
    week_number: int,
    message: str,
):
    """Notify professor that a student submitted a reclamation."""
    if not professor_email or not settings.smtp_host:
        print(f"[EMAIL] Reclamation notification for {professor_name} — SMTP not configured")
        return False

    subject = f"📩 New Reclamation — {student_name} ({module_code} Week {week_number})"

    html_body = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
        <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #06b6d4); width: 48px; height: 48px; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">A</div>
                <h1 style="color: #0f172a; font-size: 18px; margin: 12px 0 4px 0;">New Justification Request</h1>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
                <p style="color: #334155; font-size: 15px;">Bonjour <strong>{professor_name}</strong>,</p>

                <p style="color: #334155; font-size: 15px;">
                    A student has submitted a justification request for your module:
                </p>

                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #0c4a6e;"><strong>Student:</strong> {student_name} ({student_id})</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #0c4a6e;"><strong>Module:</strong> {module_code} — {module_name}</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #0c4a6e;"><strong>Session:</strong> Week {week_number}</p>
                    <p style="margin: 0; font-size: 14px; color: #0c4a6e;"><strong>Reason:</strong> {message[:200]}</p>
                </div>

                <p style="color: #334155; font-size: 14px;">
                    Please log in to AttendAI to review and approve/decline this request.
                </p>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px;">AttendAI · FST Marrakech</p>
            </div>
        </div>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = professor_email

        plain_text = f"""
Bonjour {professor_name},

New justification request from {student_name} ({student_id}):
Module: {module_code} - {module_name}, Week {week_number}
Reason: {message[:200]}

Please log in to AttendAI to review.

— AttendAI, FST Marrakech
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        print(f"[EMAIL] ✓ Reclamation notification sent to {professor_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] ✗ Failed: {e}")
        return False
