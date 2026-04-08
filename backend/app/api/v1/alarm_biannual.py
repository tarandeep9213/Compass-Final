from datetime import date as dt_date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmBiannualCheck, AlarmBuilding
from app.api.v1.alarm_audit_helper import log_alarm_event
from app.schemas.alarm import (
    AlarmBiannualCheckOut,
    CreateAlarmBiannualCheckBody,
    BiannualStatusRow,
)

_APPROVER = [Depends(require_roles(UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER))]


class ApproveBody(BaseModel):
    notes: str | None = None

class RejectBody(BaseModel):
    reason: str

router = APIRouter(prefix="/alarm/biannual", tags=["alarm-biannual"])


def _calc_next_due(check_date: str, check_type: str) -> str:
    """Calculate next due date: +6 months for cellular, +6 months for camera."""
    d = dt_date.fromisoformat(check_date)
    # Add 6 months
    month = d.month + 6
    year = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    day = min(d.day, 28)  # safe day
    return dt_date(year, month, day).isoformat()


@router.get("", response_model=list[AlarmBiannualCheckOut])
def list_biannual_checks(
    building_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlarmBiannualCheck)
    if building_id:
        q = q.filter(AlarmBiannualCheck.building_id == building_id)
    return q.order_by(AlarmBiannualCheck.check_date.desc()).all()


@router.post("", response_model=AlarmBiannualCheckOut, status_code=201)
def create_biannual_check(
    body: CreateAlarmBiannualCheckBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    next_due = _calc_next_due(body.check_date, body.check_type)

    check = AlarmBiannualCheck(
        building_id=body.building_id,
        check_type=body.check_type,
        check_date=body.check_date,
        next_due_date=next_due,
        checked_by=current_user.id,
        checked_by_name=current_user.name,
        status=body.status,
        days_verified=body.days_verified,
        notes=body.notes,
    )
    db.add(check)
    log_alarm_event(db, current_user, "BIANNUAL_CREATED", "testing", f"{body.check_type} check created for building {body.building_id} on {body.check_date}")
    db.commit()
    db.refresh(check)
    return check


@router.post("/{check_id}/submit", response_model=AlarmBiannualCheckOut)
def submit_biannual_check(
    check_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.get(AlarmBiannualCheck, check_id)
    if not c:
        raise HTTPException(404, "Check not found")
    if c.approval_status != "DRAFT":
        raise HTTPException(400, f"Check is {c.approval_status}, not DRAFT")
    c.approval_status = "SUBMITTED"
    c.submitted_at = datetime.now(timezone.utc).isoformat()
    log_alarm_event(db, current_user, "BIANNUAL_SUBMITTED", "testing", f"{c.check_type} check submitted for building {c.building_id}")
    db.commit()
    db.refresh(c)
    return c


@router.post("/{check_id}/approve", response_model=AlarmBiannualCheckOut, dependencies=_APPROVER)
def approve_biannual_check(
    check_id: str,
    body: ApproveBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.get(AlarmBiannualCheck, check_id)
    if not c:
        raise HTTPException(404, "Check not found")
    if c.approval_status != "SUBMITTED":
        raise HTTPException(400, f"Check is {c.approval_status}, not SUBMITTED")
    c.approval_status = "APPROVED"
    c.approved_by = current_user.id
    c.approved_by_name = current_user.name
    c.approved_at = datetime.now(timezone.utc).isoformat()
    log_alarm_event(db, current_user, "BIANNUAL_APPROVED", "testing", f"{c.check_type} check approved for building {c.building_id}")
    db.commit()
    db.refresh(c)
    return c


@router.post("/{check_id}/reject", response_model=AlarmBiannualCheckOut, dependencies=_APPROVER)
def reject_biannual_check(
    check_id: str,
    body: RejectBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.get(AlarmBiannualCheck, check_id)
    if not c:
        raise HTTPException(404, "Check not found")
    if c.approval_status != "SUBMITTED":
        raise HTTPException(400, f"Check is {c.approval_status}, not SUBMITTED")
    c.approval_status = "REJECTED"
    c.rejection_reason = body.reason
    log_alarm_event(db, current_user, "BIANNUAL_REJECTED", "testing", f"{c.check_type} check rejected for building {c.building_id}: {body.reason}")
    db.commit()
    db.refresh(c)
    return c


@router.post("/{check_id}/reopen", response_model=AlarmBiannualCheckOut)
def reopen_biannual_check(
    check_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.get(AlarmBiannualCheck, check_id)
    if not c:
        raise HTTPException(404, "Check not found")
    if c.approval_status != "REJECTED":
        raise HTTPException(400, f"Check is {c.approval_status}, not REJECTED")
    c.approval_status = "DRAFT"
    c.rejection_reason = None
    c.submitted_at = None
    log_alarm_event(db, current_user, "BIANNUAL_REOPENED", "testing", f"{c.check_type} check reopened for building {c.building_id}")
    db.commit()
    db.refresh(c)
    return c


@router.get("/status", response_model=list[BiannualStatusRow])
def biannual_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    buildings = db.query(AlarmBuilding).order_by(AlarmBuilding.name).all()
    all_checks = db.query(AlarmBiannualCheck).all()

    rows = []
    for b in buildings:
        def _latest_approved_or_submitted(checks, check_type):
            typed = [c for c in checks if c.building_id == b.id and c.check_type == check_type]
            # Priority: APPROVED first, then SUBMITTED, ignore DRAFT/REJECTED
            approved = sorted([c for c in typed if c.approval_status == "APPROVED"], key=lambda c: c.check_date, reverse=True)
            if approved:
                return approved[0], approved[0].status
            submitted = sorted([c for c in typed if c.approval_status == "SUBMITTED"], key=lambda c: c.check_date, reverse=True)
            if submitted:
                return submitted[0], "PENDING"
            return None, "NO_CHECK"

        cellular, cellular_status = _latest_approved_or_submitted(all_checks, "CELLULAR_BACKUP")
        camera, camera_status = _latest_approved_or_submitted(all_checks, "CAMERA_BACKUP")

        rows.append(BiannualStatusRow(
            building_id=b.id,
            building_name=b.name,
            region=b.region,
            cellular_status=cellular_status,
            cellular_next_due=cellular.next_due_date if cellular else None,
            camera_status=camera_status,
            camera_next_due=camera.next_due_date if camera else None,
        ))

    return rows
