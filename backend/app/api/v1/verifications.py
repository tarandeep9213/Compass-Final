import math
from datetime import datetime, date as dt_date, timedelta

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.location import Location
from app.services.audit import log_event
from app.models.verification import Verification, VerificationStatus, VerificationType
from app.models.config import SystemConfig
from app.schemas.verification import (
    VerificationOut, PaginatedVerifications, DowCheckResponse,
    ScheduleControllerBody, ScheduleDgmBody,
    CompleteVerificationBody, MissVerificationBody, CancelVerificationBody,
)
from app.services.email import send_visit_scheduled_background, send_visit_completed_background

router = APIRouter(prefix="/verifications", tags=["Verifications"])

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _to_out(v: Verification) -> VerificationOut:
    return VerificationOut(
        id=v.id,
        verification_type=v.verification_type.value,
        location_id=v.location_id,
        location_name=v.location_name,
        verifier_id=v.verifier_id,
        verifier_name=v.verifier_name,
        verification_date=v.verification_date,
        scheduled_time=v.scheduled_time,
        day_of_week=v.day_of_week,
        day_name=v.day_name,
        status=v.status.value,
        warning_flag=v.warning_flag,
        warning_reason=v.warning_reason,
        observed_total=v.observed_total,
        variance_vs_imprest=v.variance_vs_imprest,
        variance_pct=v.variance_pct,
        notes=v.notes,
        missed_reason=v.missed_reason,
        month_year=v.month_year,
        signature_data=v.signature_data,
        visit_section_reviews=v.visit_section_reviews,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


def _get_config(db: Session) -> SystemConfig:
    cfg = db.get(SystemConfig, 1)
    return cfg or SystemConfig()

def _now_local() -> datetime:
    return datetime.now()

def _today_local() -> dt_date:
    return dt_date.today()


def _check_dow(db: Session, location_id: str, visit_date: str, vtype: VerificationType, lookback_weeks: int) -> DowCheckResponse:
    """Check if this location has been visited on the same weekday in the recent past (2-week lookback, threshold 1)."""
    d = dt_date.fromisoformat(visit_date)
    dow = d.weekday()
    day_name = DAY_NAMES[dow]

    # Get past verifications for this location on the same weekday
    past = db.query(Verification).filter(
        Verification.location_id == location_id,
        Verification.verification_type == vtype,
        Verification.status.in_([VerificationStatus.SCHEDULED, VerificationStatus.COMPLETED]),
    ).all()

    # 2-week lookback, threshold 1 (any same-weekday visit triggers warning)
    lookback_days = 14
    matching_dates = [
        v.verification_date for v in past
        if dt_date.fromisoformat(v.verification_date).weekday() == dow
        and 0 < (d - dt_date.fromisoformat(v.verification_date)).days <= lookback_days
        and v.verification_date != visit_date
    ]

    warning = len(matching_dates) >= 1
    return DowCheckResponse(
        warning=warning,
        day_name=day_name,
        match_count=len(matching_dates),
        previous_dates=sorted(matching_dates, reverse=True)[:5],
        lookback_weeks=2,
    )


def _paginate(q, page: int, page_size: int) -> tuple:
    total = q.count()
    items = q.order_by(Verification.verification_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return total, items


# ═══════════════════════════════════════════════════════════════════════════════
# CONTROLLER VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/controller/check-dow", response_model=DowCheckResponse)
def check_dow_controller(
    location_id: str = Query(...),
    date: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = _get_config(db)
    return _check_dow(db, location_id, date, VerificationType.CONTROLLER, cfg.dow_lookback_weeks)


@router.post("/controller", response_model=VerificationOut, status_code=201)
def schedule_controller_visit(
    body: ScheduleControllerBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CONTROLLER and 'controller' not in (current_user.access_grants or []):
        raise HTTPException(403, "Only controllers can schedule controller visits")

    loc = db.get(Location, body.location_id)
    if not loc:
        raise HTTPException(404, "Location not found")

    d = dt_date.fromisoformat(body.date)
    dow = d.weekday()

    # Business week block: one visit per location per Mon-Fri week
    if dow >= 5:
        raise HTTPException(400, "Visits can only be scheduled on weekdays (Mon-Fri).")
    week_start = (d - timedelta(days=dow)).isoformat()
    week_end = (d - timedelta(days=dow) + timedelta(days=4)).isoformat()
    existing_in_week = db.query(Verification).filter(
        Verification.location_id == body.location_id,
        Verification.verification_type == VerificationType.CONTROLLER,
        Verification.status.in_([VerificationStatus.SCHEDULED, VerificationStatus.COMPLETED]),
        Verification.verification_date >= week_start,
        Verification.verification_date <= week_end,
    ).first()
    if existing_in_week:
        if existing_in_week.verification_date == body.date:
            raise HTTPException(400, f"A visit already exists for this location on {body.date}.")
        raise HTTPException(400, f"A visit already exists for this location in the week of {week_start} to {week_end}.")

    v = Verification(
        verification_type=VerificationType.CONTROLLER,
        location_id=body.location_id,
        location_name=loc.name,
        verifier_id=current_user.id,
        verifier_name=current_user.name,
        verification_date=body.date,
        scheduled_time=body.scheduled_time,
        day_of_week=dow,
        day_name=DAY_NAMES[dow],
        status=VerificationStatus.SCHEDULED,
        warning_flag=body.dow_warning_acknowledged,
        warning_reason=body.dow_warning_reason,
        notes=body.notes or "",
    )
    db.add(v)
    log_event(db, current_user, "VERIFICATION_SCHEDULED",
              f"Controller visit to {loc.name} scheduled for {body.date}",
              location_id=body.location_id, location_name=loc.name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)

    # N-05: Notify DGMs about the scheduled controller visit
    dgms = db.query(User).filter(User.active == True, User.role == UserRole.DGM).all()
    for dgm in dgms:
        send_visit_scheduled_background(
            background,
            recipient_email=dgm.email,
            recipient_name=dgm.name,
            visit_type="Controller",
            verifier_name=current_user.name,
            location_name=loc.name,
            visit_date=body.date,
            scheduled_time=body.scheduled_time,
            warning_flag=v.warning_flag,
        )

    return _to_out(v)


@router.get("/controller", response_model=PaginatedVerifications)
def list_controller_verifications(
    location_id: str | None = Query(None),
    status: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Verification).filter(Verification.verification_type == VerificationType.CONTROLLER)

    if current_user.role == UserRole.CONTROLLER:
        q = q.filter(Verification.verifier_id == current_user.id)

    if location_id:
        q = q.filter(Verification.location_id == location_id)
    if status:
        q = q.filter(Verification.status == status)
    if date_from:
        q = q.filter(Verification.verification_date >= date_from)
    if date_to:
        q = q.filter(Verification.verification_date <= date_to)

    total, items = _paginate(q, page, page_size)
    return PaginatedVerifications(
        items=[_to_out(v) for v in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.patch("/controller/{visit_id}/complete", response_model=VerificationOut)
def complete_controller_visit(
    visit_id: str,
    body: CompleteVerificationBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.CONTROLLER:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Visit is not in scheduled state")
    # SLA window check: if visit has a scheduled time on today, enforce configurable window
    visit_date = dt_date.fromisoformat(v.verification_date)
    today = _today_local()
    if visit_date == today and v.scheduled_time:
        cfg = _get_config(db)
        sla_hours = cfg.approval_sla_hours or 48
        h, m = map(int, v.scheduled_time.split(':'))
        sched_dt = datetime(visit_date.year, visit_date.month, visit_date.day, h, m)
        now = _now_local()
        if now < sched_dt:
            raise HTTPException(400, f"Too early — visit is scheduled for {v.scheduled_time}.")
        if now > sched_dt + timedelta(hours=sla_hours):
            raise HTTPException(400, f"{sla_hours}-hour completion window has passed (scheduled {v.scheduled_time}). Use 'Mark as Missed'.")

    v.status = VerificationStatus.COMPLETED
    v.observed_total = body.observed_total
    v.signature_data = body.signature_data
    v.notes = body.notes or v.notes
    v.visit_section_reviews = body.visit_section_reviews
    if body.dow_warning_reason:
        v.warning_reason = body.dow_warning_reason
    # Compute variance against location expected cash
    loc = db.get(Location, v.location_id)
    expected = loc.expected_cash if loc else 0
    if body.observed_total is not None and expected > 0:
        v.variance_vs_imprest = round(body.observed_total - expected, 2)
        v.variance_pct = round((body.observed_total - expected) / expected * 100, 4)
    log_event(db, current_user, "VERIFICATION_COMPLETED",
              f"Controller visit to {v.location_name} on {v.verification_date} completed",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)

    # N-06: Notify DGMs when controller visit is completed
    dgms = db.query(User).filter(User.active == True, User.role == UserRole.DGM).all()
    for dgm in dgms:
        send_visit_completed_background(
            background,
            recipient_email=dgm.email,
            recipient_name=dgm.name,
            visit_type="Controller",
            verifier_name=v.verifier_name,
            location_name=v.location_name,
            visit_date=v.verification_date,
            observed_total=f"${body.observed_total:,.2f}",
            notes=body.notes or "",
        )

    return _to_out(v)


@router.patch("/controller/{visit_id}/miss", response_model=VerificationOut)
def miss_controller_visit(
    visit_id: str,
    body: MissVerificationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.CONTROLLER:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Visit is not in scheduled state")
    # Miss: only for past dates, or today after SLA window
    visit_date = dt_date.fromisoformat(v.verification_date)
    today = _today_local()
    if visit_date > today:
        raise HTTPException(400, "Cannot mark a future visit as missed. Use 'Cancel' instead.")
    if visit_date == today and v.scheduled_time:
        cfg = _get_config(db)
        sla_hours = cfg.approval_sla_hours or 48
        h, m = map(int, v.scheduled_time.split(':'))
        sched_dt = datetime(visit_date.year, visit_date.month, visit_date.day, h, m)
        if _now_local() <= sched_dt + timedelta(hours=sla_hours):
            raise HTTPException(400, f"Completion window is still open (until {sla_hours}hrs after {v.scheduled_time}). Complete or wait before marking as missed.")

    v.status = VerificationStatus.MISSED
    v.missed_reason = body.missed_reason
    v.notes = body.notes or v.notes
    log_event(db, current_user, "VERIFICATION_MISSED",
              f"Controller visit to {v.location_name} on {v.verification_date} missed: {body.missed_reason}",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)
    return _to_out(v)


@router.patch("/controller/{visit_id}/cancel", response_model=VerificationOut)
def cancel_controller_visit(
    visit_id: str,
    body: CancelVerificationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.CONTROLLER:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Only scheduled visits can be cancelled")
    visit_date = dt_date.fromisoformat(v.verification_date)
    today = _today_local()
    if visit_date == today and v.scheduled_time:
        h, m = map(int, v.scheduled_time.split(':'))
        sched_dt = datetime(visit_date.year, visit_date.month, visit_date.day, h, m)
        if _now_local() >= sched_dt:
            raise HTTPException(400, "Cannot cancel — the scheduled time has arrived. Use 'Complete' or 'Mark as Missed'.")

    v.status = VerificationStatus.CANCELLED
    v.notes = body.notes or v.notes
    log_event(db, current_user, "VERIFICATION_CANCELLED",
              f"Controller visit to {v.location_name} on {v.verification_date} cancelled",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)
    return _to_out(v)


# ═══════════════════════════════════════════════════════════════════════════════
# DGM VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dgm/check-dom", response_model=DowCheckResponse)
def check_dom_dgm(
    location_id: str = Query(...),
    date: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if this location has been visited on the same day-of-month in the past 3 months."""
    d = dt_date.fromisoformat(date)
    dom = d.day

    past = db.query(Verification).filter(
        Verification.location_id == location_id,
        Verification.verification_type == VerificationType.DGM,
        Verification.status.in_([VerificationStatus.SCHEDULED, VerificationStatus.COMPLETED]),
    ).all()

    # 3-month lookback: warn if same day-of-month visited
    matching_dates = [
        v.verification_date for v in past
        if dt_date.fromisoformat(v.verification_date).day == dom
        and 0 < (d - dt_date.fromisoformat(v.verification_date)).days <= 92  # ~3 months
        and v.verification_date != date
    ]

    warning = len(matching_dates) >= 1
    return DowCheckResponse(
        warning=warning,
        day_name=f"{dom}{'th' if 11 <= dom <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(dom % 10, 'th')}",
        match_count=len(matching_dates),
        previous_dates=sorted(matching_dates, reverse=True)[:5],
        lookback_weeks=13,  # ~3 months
    )


@router.post("/dgm", response_model=VerificationOut, status_code=201)
def schedule_dgm_visit(
    body: ScheduleDgmBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.DGM:
        raise HTTPException(403, "Only DGMs can schedule DGM visits")

    loc = db.get(Location, body.location_id)
    if not loc:
        raise HTTPException(404, "Location not found")

    d = dt_date.fromisoformat(body.date)
    dow = d.weekday()
    month_year = body.date[:7]  # YYYY-MM

    # Calendar month block: one visit per location per month
    month_start = d.replace(day=1).isoformat()
    if d.month == 12:
        month_end = d.replace(year=d.year + 1, month=1, day=1).isoformat()
    else:
        month_end = d.replace(month=d.month + 1, day=1).isoformat()
    existing_in_month = db.query(Verification).filter(
        Verification.location_id == body.location_id,
        Verification.verification_type == VerificationType.DGM,
        Verification.verification_date >= month_start,
        Verification.verification_date < month_end,
        Verification.status.in_([VerificationStatus.SCHEDULED, VerificationStatus.COMPLETED]),
    ).first()
    if existing_in_month:
        month_name = d.strftime('%B %Y')
        if existing_in_month.verification_date == body.date:
            raise HTTPException(400, f"A DGM visit already exists for this location on {body.date}.")
        raise HTTPException(400, f"A DGM visit already exists for this location in {month_name}.")

    v = Verification(
        verification_type=VerificationType.DGM,
        location_id=body.location_id,
        location_name=loc.name,
        verifier_id=current_user.id,
        verifier_name=current_user.name,
        verification_date=body.date,
        scheduled_time=None,
        day_of_week=dow,
        day_name=DAY_NAMES[dow],
        status=VerificationStatus.SCHEDULED,
        warning_flag=False,
        notes=body.notes or "",
        month_year=month_year,
    )
    db.add(v)
    log_event(db, current_user, "VERIFICATION_SCHEDULED",
              f"DGM visit to {loc.name} scheduled for {body.date}",
              location_id=body.location_id, location_name=loc.name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)

    # N-07: Notify Regional Controllers about DGM visit
    rcs = db.query(User).filter(User.active == True, User.role == UserRole.REGIONAL_CONTROLLER).all()
    for rc in rcs:
        send_visit_scheduled_background(
            background,
            recipient_email=rc.email,
            recipient_name=rc.name,
            visit_type="DGM",
            verifier_name=current_user.name,
            location_name=loc.name,
            visit_date=body.date,
            scheduled_time=None,
            warning_flag=False,
        )

    return _to_out(v)


@router.get("/dgm", response_model=PaginatedVerifications)
def list_dgm_verifications(
    location_id: str | None = Query(None),
    status: str | None = Query(None),
    month_year: str | None = Query(None),
    year: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Verification).filter(Verification.verification_type == VerificationType.DGM)

    if current_user.role == UserRole.DGM:
        q = q.filter(Verification.verifier_id == current_user.id)
    else:
        # Non-DGM roles (controller, regional-controller, admin) must not see future DGM visits
        q = q.filter(Verification.verification_date <= dt_date.today().isoformat())

    if location_id:
        q = q.filter(Verification.location_id == location_id)
    if status:
        q = q.filter(Verification.status == status)
    if month_year:
        q = q.filter(Verification.month_year == month_year)
    if year:
        q = q.filter(Verification.verification_date.like(f"{year}-%"))

    total, items = _paginate(q, page, page_size)
    return PaginatedVerifications(
        items=[_to_out(v) for v in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.patch("/dgm/{visit_id}/complete", response_model=VerificationOut)
def complete_dgm_visit(
    visit_id: str,
    body: CompleteVerificationBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.DGM:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Visit is not in scheduled state")
    # SLA window: visit date + approval_sla_hours
    visit_date = dt_date.fromisoformat(v.verification_date)
    cfg = _get_config(db)
    sla_hours = cfg.approval_sla_hours or 48
    visit_start = datetime(visit_date.year, visit_date.month, visit_date.day)
    if _now_local() > visit_start + timedelta(hours=sla_hours):
        raise HTTPException(400, f"{sla_hours}-hour completion window has passed for this visit. Use 'Mark as Missed'.")
    v.status = VerificationStatus.COMPLETED
    v.observed_total = body.observed_total
    v.signature_data = body.signature_data
    v.notes = body.notes or v.notes
    v.visit_section_reviews = body.visit_section_reviews
    # Compute variance against location expected cash
    loc = db.get(Location, v.location_id)
    expected = loc.expected_cash if loc else 0
    if body.observed_total is not None and expected > 0:
        v.variance_vs_imprest = round(body.observed_total - expected, 2)
        v.variance_pct = round((body.observed_total - expected) / expected * 100, 4)
    log_event(db, current_user, "VERIFICATION_COMPLETED",
              f"DGM visit to {v.location_name} on {v.verification_date} completed",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)

    # N-08: Notify Regional Controllers when DGM visit is completed
    rcs = db.query(User).filter(User.active == True, User.role == UserRole.REGIONAL_CONTROLLER).all()
    for rc in rcs:
        send_visit_completed_background(
            background,
            recipient_email=rc.email,
            recipient_name=rc.name,
            visit_type="DGM",
            verifier_name=v.verifier_name,
            location_name=v.location_name,
            visit_date=v.verification_date,
            observed_total=f"${body.observed_total:,.2f}",
            notes=body.notes or "",
        )

    return _to_out(v)


@router.patch("/dgm/{visit_id}/cancel", response_model=VerificationOut)
def cancel_dgm_visit(
    visit_id: str,
    body: CancelVerificationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.DGM:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Only scheduled visits can be cancelled")

    v.status = VerificationStatus.CANCELLED
    v.notes = body.notes or v.notes
    log_event(db, current_user, "VERIFICATION_CANCELLED",
              f"DGM visit to {v.location_name} on {v.verification_date} cancelled",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)
    return _to_out(v)


@router.patch("/dgm/{visit_id}/miss", response_model=VerificationOut)
def miss_dgm_visit(
    visit_id: str,
    body: MissVerificationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.get(Verification, visit_id)
    if not v or v.verification_type != VerificationType.DGM:
        raise HTTPException(404, "Visit not found")
    if v.verifier_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Access denied")
    if v.status != VerificationStatus.SCHEDULED:
        raise HTTPException(400, "Visit is not in scheduled state")
    # DGM: miss only for past dates
    visit_date = dt_date.fromisoformat(v.verification_date)
    if visit_date >= _today_local():
        raise HTTPException(400, "Cannot mark today/future visit as missed. Use 'Cancel' for future visits, or complete today's visit.")

    v.status = VerificationStatus.MISSED
    v.missed_reason = body.missed_reason
    v.notes = body.notes or v.notes
    log_event(db, current_user, "VERIFICATION_MISSED",
              f"DGM visit to {v.location_name} on {v.verification_date} missed: {body.missed_reason}",
              location_id=v.location_id, location_name=v.location_name,
              entity_id=v.id, entity_type="Verification")
    db.commit()
    db.refresh(v)
    return _to_out(v)
