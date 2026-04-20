"""
/v1/closures/* — report and list legitimate cashroom closures (holiday,
weather, OTHER). See docs/BUGS_2026-04-20.md#issue-2 for rationale.

MVP scope: POST + GET only. PATCH/DELETE/compliance-integration deferred.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.closure import ClosureRecord
from app.models.location import Location
from app.models.user import User, UserRole
from app.schemas.closure import ClosureOut, CreateClosureBody, PaginatedClosures
from app.services.audit import log_event


router = APIRouter(prefix="/closures", tags=["Closures"])


def _can_report_for_location(user: User, location_id: str) -> bool:
    """Operators report only for their assigned locations; others (CONTROLLER,
    DGM, ADMIN, RC) can report for any location within their RBAC scope —
    which the frontend won't expose anyway in this MVP."""
    if user.role == UserRole.OPERATOR:
        return location_id in (user.location_ids or [])
    # CONTROLLER / DGM / ADMIN / REGIONAL_CONTROLLER allowed by default
    return user.role in (
        UserRole.CONTROLLER,
        UserRole.DGM,
        UserRole.ADMIN,
        UserRole.REGIONAL_CONTROLLER,
    )


def _closure_out(c: ClosureRecord, location_name: str, reporter_name: str) -> ClosureOut:
    return ClosureOut(
        id=c.id,
        location_id=c.location_id,
        location_name=location_name,
        closure_date=c.closure_date,
        reason=c.reason,
        notes=c.notes,
        reported_by_id=c.reported_by_id,
        reported_by_name=reporter_name,
        reported_at=c.reported_at,
    )


@router.post("", response_model=ClosureOut, status_code=201)
def create_closure(
    body: CreateClosureBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _can_report_for_location(current_user, body.location_id):
        raise HTTPException(403, "You can only report closures for your assigned locations")

    loc = db.get(Location, body.location_id)
    if not loc:
        raise HTTPException(404, f"Location {body.location_id} not found")

    c = ClosureRecord(
        location_id=body.location_id,
        closure_date=body.closure_date,
        reason=body.reason,
        notes=body.notes.strip(),
        reported_by_id=current_user.id,
    )
    db.add(c)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            f"A closure is already reported for {loc.name} on {body.closure_date}",
        )

    log_event(
        db, current_user, "CLOSURE_REPORTED",
        f"Closure reported for {loc.name} on {body.closure_date} ({body.reason.value})"
        + (f" — {body.notes.strip()}" if body.notes.strip() else ""),
        location_id=body.location_id, location_name=loc.name,
        entity_id=c.id, entity_type="ClosureRecord",
    )
    db.commit()
    db.refresh(c)
    return _closure_out(c, loc.name, current_user.name)


@router.get("", response_model=PaginatedClosures)
def list_closures(
    location_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ClosureRecord)
    if location_id:
        q = q.filter(ClosureRecord.location_id == location_id)
    if date_from:
        q = q.filter(ClosureRecord.closure_date >= date_from)
    if date_to:
        q = q.filter(ClosureRecord.closure_date <= date_to)

    # Operators can only see closures for their assigned locations.
    if current_user.role == UserRole.OPERATOR:
        loc_ids = current_user.location_ids or []
        q = q.filter(ClosureRecord.location_id.in_(loc_ids))

    rows = q.order_by(ClosureRecord.closure_date.desc()).all()

    # Batch-resolve location + reporter names (avoid N+1).
    loc_ids = {r.location_id for r in rows}
    user_ids = {r.reported_by_id for r in rows}
    locs = {l.id: l.name for l in db.query(Location).filter(Location.id.in_(loc_ids)).all()} if loc_ids else {}
    users = {u.id: u.name for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    items = [
        _closure_out(r, locs.get(r.location_id, r.location_id), users.get(r.reported_by_id, "?"))
        for r in rows
    ]
    return PaginatedClosures(items=items, total=len(items))
