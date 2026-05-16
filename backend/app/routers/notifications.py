"""
In-app notification system.
Tracks email alerts sent, session completions, and risk warnings.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime

from app.database import get_db
from app.models import User
from app.auth import get_current_user

router = APIRouter()

# In-memory notification store (in production, use a DB table)
notifications_store: list[dict] = []


def add_notification(title: str, message: str, type: str = "info", for_role: str = "all", link: str = ""):
    """Add a notification to the store."""
    notifications_store.insert(0, {
        "id": len(notifications_store) + 1,
        "title": title,
        "message": message,
        "type": type,  # info, warning, success, error
        "for_role": for_role,  # all, admin, professor
        "link": link,  # optional navigation link
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })
    # Keep only last 50
    if len(notifications_store) > 50:
        notifications_store.pop()


@router.get("/")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get notifications for the current user."""
    filtered = [
        n for n in notifications_store
        if n["for_role"] == "all" or n["for_role"] == user.role
    ]
    return {"notifications": filtered[:20], "unread_count": sum(1 for n in filtered[:20] if not n["read"])}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    for n in notifications_store:
        if n["for_role"] == "all" or n["for_role"] == user.role:
            n["read"] = True
    return {"message": "All notifications marked as read."}
