import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.audit import AuditEvent

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR, UserRole.REGIONAL_CONTROLLER))])
def list_audit_events(
    event_type: str | None = Query(None),
    actor_id: str | None = Query(None),
    location_id: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(AuditEvent)
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    if actor_id:
        q = q.filter(AuditEvent.actor_id == actor_id)
    if location_id:
        q = q.filter(AuditEvent.location_id == location_id)
    if date_from:
        q = q.filter(AuditEvent.created_at >= date_from)
    if date_to:
        q = q.filter(AuditEvent.created_at <= date_to + "T23:59:59")

    total = q.count()
    items = q.order_by(AuditEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [{
            "id": e.id,
            "event_type": e.event_type,
            "actor_id": e.actor_id,
            "actor_name": e.actor_name,
            "actor_role": e.actor_role,
            "location_id": e.location_id,
            "location_name": e.location_name,
            "entity_id": e.entity_id,
            "entity_type": e.entity_type,
            "detail": e.detail,
            "old_value": e.old_value,
            "new_value": e.new_value,
            "ip_address": e.ip_address,
            "created_at": e.created_at.isoformat(),
        } for e in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/filter-options", dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR, UserRole.REGIONAL_CONTROLLER))])
def get_filter_options(
    event_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AuditEvent)
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    events = q.all()

    actors = {e.actor_id: e.actor_name for e in events}
    locations = {e.location_id: e.location_name for e in events if e.location_id}

    return {
        "actors": [{"id": k, "name": v} for k, v in actors.items()],
        "locations": [{"id": k, "name": v} for k, v in locations.items()],
    }
