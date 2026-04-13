from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmAuditEvent
from app.schemas.alarm import (
    AlarmAuditEventOut,
    CreateAlarmAuditEventBody,
    PaginatedAlarmAudit,
)

router = APIRouter(prefix="/alarm/audit", tags=["alarm-audit"])

# Audit trail readers: alarm-side (approver/admin) + cross-functional cashroom roles
_AUDIT_READER = [Depends(require_roles(
    UserRole.ALARM_APPROVER, UserRole.ALARM_ADMIN,
    UserRole.CONTROLLER, UserRole.DGM, UserRole.REGIONAL_CONTROLLER,
))]
# All authenticated alarm/cashroom users may LOG events (handled by helpers); kept open here
_AUDIT_WRITER = [Depends(require_roles(
    UserRole.ALARM_TESTER, UserRole.ALARM_APPROVER, UserRole.ALARM_ADMIN,
    UserRole.CONTROLLER, UserRole.DGM, UserRole.REGIONAL_CONTROLLER, UserRole.ADMIN,
))]


@router.get("", response_model=PaginatedAlarmAudit, dependencies=_AUDIT_READER)
def list_audit_events(
    category: str | None = Query(None),
    search: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlarmAuditEvent)

    if category:
        q = q.filter(AlarmAuditEvent.category == category)
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(
            AlarmAuditEvent.details.ilike(pattern),
            AlarmAuditEvent.action.ilike(pattern),
            AlarmAuditEvent.user_name.ilike(pattern),
        ))
    if date_from:
        q = q.filter(AlarmAuditEvent.timestamp >= date_from)
    if date_to:
        q = q.filter(AlarmAuditEvent.timestamp <= date_to + "T23:59:59")

    total = q.count()
    items = q.order_by(AlarmAuditEvent.timestamp.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedAlarmAudit(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=AlarmAuditEventOut, status_code=201, dependencies=_AUDIT_WRITER)
def log_audit_event(
    body: CreateAlarmAuditEventBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = AlarmAuditEvent(
        action=body.action,
        category=body.category,
        user_id=current_user.id,
        user_name=current_user.name,
        details=body.details,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
