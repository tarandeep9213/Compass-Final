"""Shared helper to log alarm audit events from any alarm endpoint."""
from sqlalchemy.orm import Session
from app.models.alarm import AlarmAuditEvent
from app.models.user import User


def log_alarm_event(db: Session, user: User, action: str, category: str, details: str):
    """Log an alarm audit event. Call from any alarm API endpoint."""
    event = AlarmAuditEvent(
        action=action,
        category=category,
        user_id=user.id,
        user_name=user.name,
        details=details,
    )
    db.add(event)
    # Don't commit — caller commits as part of their transaction
