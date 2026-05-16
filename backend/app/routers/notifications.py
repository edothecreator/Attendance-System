"""
In-app notification system.
Tracks email alerts sent, session completions, and risk warnings.
Admin sees all. Professors see only their module's notifications.
"""
from fastapi import APIRouter, Depends
from datetime import datetime

from app.models import User
from app.auth import get_current_user

router = APIRouter()

# In-memory notification store (in production, use a DB table)
notifications_store: list[dict] = []


def add_notification(title: str, message: str, type: str = "info", for_role: str = "all", link: str = "", for_module: str = ""):
    """
    Add a notification to the store.
    for_role: "all", "admin", "professor"
    for_module: module_id string — if set, only that module's professor sees it
    """
    notifications_store.insert(0, {
        "id": len(notifications_store) + 1,
        "title": title,
        "message": message,
        "type": type,
        "for_role": for_role,
        "for_module": for_module,  # empty = all modules
        "link": link,
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })
    # Keep only last 100
    if len(notifications_store) > 100:
        notifications_store.pop()


@router.get("/")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get notifications for the current user based on role and module."""
    filtered = []
    for n in notifications_store:
        # Admin sees everything
        if user.role == "admin":
            filtered.append(n)
            continue

        # Check role filter
        role_match = n["for_role"] == "all" or n["for_role"] == user.role

        # Check module filter (if set, must match professor's module)
        module_match = True
        if n["for_module"] and user.module_id:
            module_match = n["for_module"] == str(user.module_id)

        if role_match and module_match:
            filtered.append(n)

    result = filtered[:20]
    return {"notifications": result, "unread_count": sum(1 for n in result if not n["read"])}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    """Mark all notifications as read for this user."""
    for n in notifications_store:
        if user.role == "admin":
            n["read"] = True
        else:
            role_match = n["for_role"] == "all" or n["for_role"] == user.role
            module_match = not n["for_module"] or n["for_module"] == str(user.module_id)
            if role_match and module_match:
                n["read"] = True
    return {"message": "All notifications marked as read."}
