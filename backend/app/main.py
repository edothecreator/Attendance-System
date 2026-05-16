import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import students, sessions, websocket, modules, auth_router, analytics, overrides, qr_attendance, notifications, reports, student_portal, audit, dashboard, reclamations, live_scan

app = FastAPI(title="AttendAI - FST Marrakech", version="2.0.0", description="Automated Facial Recognition Attendance System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(student_portal.router, prefix="/api/portal", tags=["student-portal"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(modules.router, prefix="/api/modules", tags=["modules"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(overrides.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(qr_attendance.router, prefix="/api/qr", tags=["qr-attendance"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(reclamations.router, prefix="/api/reclamations", tags=["reclamations"])
app.include_router(live_scan.router, prefix="/api/live", tags=["live-scan"])
app.include_router(websocket.router, tags=["websocket"])

os.makedirs(settings.upload_dir, exist_ok=True)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AttendAI - FST Marrakech"}
