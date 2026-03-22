"""
Audit logging helper — call log_event() from any route handler.
"""
from sqlalchemy.orm import Session
from app.models.audit import AuditEvent
from app.models.user import User


def log_event(
    db: Session,
    actor: User,
    event_type: str,
    detail: str,
    location_id: str | None = None,
    location_name: str | None = None,
    entity_id: str | None = None,
    entity_type: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Write an audit event row. Never raises."""
    try:
        ev = AuditEvent(
            event_type=event_type,
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role.value,
            location_id=location_id,
            location_name=location_name,
            entity_id=entity_id,
            entity_type=entity_type,
            detail=detail,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
        )
        db.add(ev)
        db.flush()   # write in same transaction, caller commits
    except Exception:
        pass  # audit must never break the main operation
