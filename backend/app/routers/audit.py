"""
Audit Log — tracks all significant actions in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from app.models import User
from app.auth import require_admin

router = APIRouter()

# In-memory audit store (production: use a DB table)
audit_log: list[dict] = []


def log_action(actor: str, action: str, target: str, detail: str = ""):
    """Record an action in the audit log."""
    audit_log.insert(0, {
        "id": len(audit_log) + 1,
        "actor": actor,
        "action": action,
        "target": target,
        "detail": detail,
        "timestamp": datetime.utcnow().isoformat(),
    })
    # Keep last 200 entries
    if len(audit_log) > 200:
        audit_log.pop()


@router.get("/")
async def get_audit_log(user: User = Depends(require_admin)):
    """Get the full audit log (admin only)."""
    return {"logs": audit_log[:100]}
