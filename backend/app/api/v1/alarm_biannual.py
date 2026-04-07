from datetime import date as dt_date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.alarm import AlarmBiannualCheck, AlarmBuilding
from app.schemas.alarm import (
    AlarmBiannualCheckOut,
    CreateAlarmBiannualCheckBody,
    BiannualStatusRow,
)

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
    db.commit()
    db.refresh(check)
    return check


@router.get("/status", response_model=list[BiannualStatusRow])
def biannual_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    buildings = db.query(AlarmBuilding).order_by(AlarmBuilding.name).all()
    all_checks = db.query(AlarmBiannualCheck).all()

    rows = []
    for b in buildings:
        # Latest cellular check
        cellular_checks = sorted(
            [c for c in all_checks if c.building_id == b.id and c.check_type == "CELLULAR_BACKUP"],
            key=lambda c: c.check_date, reverse=True,
        )
        cellular = cellular_checks[0] if cellular_checks else None

        # Latest camera check
        camera_checks = sorted(
            [c for c in all_checks if c.building_id == b.id and c.check_type == "CAMERA_BACKUP"],
            key=lambda c: c.check_date, reverse=True,
        )
        camera = camera_checks[0] if camera_checks else None

        rows.append(BiannualStatusRow(
            building_id=b.id,
            building_name=b.name,
            region=b.region,
            cellular_status=cellular.status if cellular else "NO_CHECK",
            cellular_next_due=cellular.next_due_date if cellular else None,
            camera_status=camera.status if camera else "NO_CHECK",
            camera_next_due=camera.next_due_date if camera else None,
        ))

    return rows
