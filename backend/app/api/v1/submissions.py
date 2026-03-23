import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus, SubmissionSource, MissedSubmission
from app.models.config import SystemConfig
from app.schemas.submission import (
    SubmissionOut, SubmissionDetailOut, PaginatedSubmissions,
    CreateSubmissionBody, SubmitBody, ApproveBody, RejectBody, ApproveResponse,
    MissedSubmissionOut, PaginatedMissed, CreateMissedBody,
)
from app.services.email import (
    send_submission_pending_background,
    send_submission_approved_background,
    send_submission_rejected_background,
    send_missed_explanation_background,
)
from app.services.audit import log_event

router = APIRouter(tags=["Submissions"])

_REVIEWER_ROLES = (UserRole.CONTROLLER,)


def _fmt_currency(v: float) -> str:
    return f"£{v:,.2f}"


def _calc_totals(sections: dict, expected_cash: float, tolerance_pct: float) -> dict:
    """Sum all section totals and compute variance fields."""
    total = sum(
        float(sec.get("total", 0))
        for sec in sections.values()
        if isinstance(sec, dict)
    )
    variance = total - expected_cash
    variance_pct = (variance / expected_cash * 100) if expected_cash else 0.0
    variance_exception = abs(variance_pct) > tolerance_pct
    return {
        "total_cash": total,
        "variance": variance,
        "variance_pct": variance_pct,
        "variance_exception": variance_exception,
    }


def _to_out(s: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=s.id,
        location_id=s.location_id,
        location_name=s.location_name,
        operator_id=s.operator_id,
        operator_name=s.operator_name,
        submission_date=s.submission_date,
        status=s.status.value,
        source=s.source.value,
        total_cash=s.total_cash,
        expected_cash=s.expected_cash,
        variance=s.variance,
        variance_pct=s.variance_pct,
        variance_exception=s.variance_exception,
        variance_note=s.variance_note,
        approved_by=s.approved_by,
        approved_by_name=s.approved_by_name,
        approved_at=s.approved_at.isoformat() if s.approved_at else None,
        rejection_reason=s.rejection_reason,
        submitted_at=s.submitted_at.isoformat() if s.submitted_at else None,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


def _get_config(db: Session) -> SystemConfig:
    cfg = db.get(SystemConfig, 1)
    return cfg or SystemConfig()


# ── List submissions ──────────────────────────────────────────────────────────

@router.get("/submissions", response_model=PaginatedSubmissions)
def list_submissions(
    location_id: str | None = Query(None),
    status: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    operator_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Submission)

    # Operators see only their own submissions
    if current_user.role == UserRole.OPERATOR:
        q = q.filter(Submission.operator_id == current_user.id)
    elif current_user.role == UserRole.CONTROLLER:
        if current_user.location_ids:
            q = q.filter(Submission.location_id.in_(current_user.location_ids))

    if location_id:
        q = q.filter(Submission.location_id == location_id)
    if status:
        q = q.filter(Submission.status == status)
    if date_from:
        q = q.filter(Submission.submission_date >= date_from)
    if date_to:
        q = q.filter(Submission.submission_date <= date_to)
    if operator_id:
        q = q.filter(Submission.operator_id == operator_id)

    total = q.count()
    items = q.order_by(Submission.submission_date.desc(), Submission.created_at.desc()) \
             .offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedSubmissions(
        items=[_to_out(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ── Get single submission ─────────────────────────────────────────────────────

@router.get("/submissions/{submission_id}", response_model=SubmissionDetailOut)
def get_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.get(Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    if current_user.role == UserRole.OPERATOR and s.operator_id != current_user.id:
        raise HTTPException(403, "Access denied")
    if current_user.role == UserRole.CONTROLLER and s.location_id not in (current_user.location_ids or []):
        raise HTTPException(404, "Submission not found")
    out = _to_out(s)
    return SubmissionDetailOut(**out.model_dump(), sections=s.sections)


# ── Create (or save as draft) ─────────────────────────────────────────────────

@router.post("/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(
    body: CreateSubmissionBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN):
        raise HTTPException(403, "Only operators can create submissions")

    loc = db.get(Location, body.location_id)
    if not loc:
        raise HTTPException(404, "Location not found")

    cfg = _get_config(db)
    tolerance = loc.tolerance_pct_override if loc.tolerance_pct_override is not None else cfg.default_tolerance_pct
    totals = _calc_totals(body.sections, 0.0, tolerance)

    s = Submission(
        location_id=body.location_id,
        location_name=loc.name,
        operator_id=current_user.id,
        operator_name=current_user.name,
        submission_date=body.submission_date,
        status=SubmissionStatus.DRAFT if body.save_as_draft else SubmissionStatus.PENDING_APPROVAL,
        source=SubmissionSource(body.source),
        sections=body.sections,
        variance_note=body.variance_note,
        expected_cash=0.0,
        **totals,
    )
    if not body.save_as_draft:
        s.submitted_at = datetime.now(timezone.utc)

    db.add(s)
    log_event(db, current_user, "SUBMISSION_CREATED",
              f"Submission created for {loc.name} on {body.submission_date}",
              location_id=body.location_id, location_name=loc.name,
              entity_id=s.id, entity_type="Submission")
    db.commit()
    db.refresh(s)

    # N-01: Notify controllers assigned to this location when submitted (not draft)
    if not body.save_as_draft:
        reviewers = db.query(User).filter(
            User.active == True,
            User.role == UserRole.CONTROLLER,
        ).all()
        for reviewer in reviewers:
            if body.location_id not in (reviewer.location_ids or []):
                continue
            send_submission_pending_background(
                background,
                reviewer_email=reviewer.email,
                reviewer_name=reviewer.name,
                operator_name=current_user.name,
                location_name=loc.name,
                submission_date=body.submission_date,
                total_cash=_fmt_currency(totals["total_cash"]),
                variance=_fmt_currency(totals["variance"]),
                variance_exception=totals["variance_exception"],
            )

    return _to_out(s)


# ── Update draft ──────────────────────────────────────────────────────────────

@router.put("/submissions/{submission_id}", response_model=SubmissionOut)
def update_draft(
    submission_id: str,
    body: CreateSubmissionBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.get(Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    if s.operator_id != current_user.id:
        raise HTTPException(403, "Access denied")
    if s.status not in (SubmissionStatus.DRAFT, SubmissionStatus.REJECTED, SubmissionStatus.PENDING_APPROVAL):
        raise HTTPException(400, "Only draft, rejected, or pending submissions can be updated")

    loc = db.get(Location, body.location_id)
    cfg = _get_config(db)
    tolerance = loc.tolerance_pct_override if loc and loc.tolerance_pct_override is not None else cfg.default_tolerance_pct
    totals = _calc_totals(body.sections, s.expected_cash, tolerance)

    from sqlalchemy.orm.attributes import flag_modified # add this import locally, or at top of file

    s.sections = body.sections
    flag_modified(s, "sections") # Force SQLAlchemy to track the JSON update
    
    s.variance_note = body.variance_note
    s.source = SubmissionSource(body.source)
    for k, v in totals.items():
        setattr(s, k, v)

    # When updating a rejected submission, reset it to draft so it can be submitted
    if s.status == SubmissionStatus.REJECTED:
        s.status = SubmissionStatus.DRAFT
        s.rejection_reason = None
    # pending_approval stays as-is — already submitted, just updating the data

    db.commit()
    db.refresh(s)
    return _to_out(s)


# ── Submit draft ──────────────────────────────────────────────────────────────

@router.post("/submissions/{submission_id}/submit", response_model=SubmissionOut)
def submit_draft(
    submission_id: str,
    body: SubmitBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.get(Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    if s.operator_id != current_user.id:
        raise HTTPException(403, "Access denied")
    if s.status not in (SubmissionStatus.DRAFT, SubmissionStatus.PENDING_APPROVAL):
        raise HTTPException(400, "Only draft or pending submissions can be submitted")

    if s.status == SubmissionStatus.DRAFT:
        s.status = SubmissionStatus.PENDING_APPROVAL
        s.submitted_at = datetime.now(timezone.utc)
    if body.variance_note:
        s.variance_note = body.variance_note
    log_event(db, current_user, "SUBMISSION_SUBMITTED",
              f"Submission submitted for {s.location_name} on {s.submission_date}",
              location_id=s.location_id, location_name=s.location_name,
              entity_id=s.id, entity_type="Submission")
    db.commit()
    db.refresh(s)

    # N-02: Notify controllers assigned to this location
    reviewers = db.query(User).filter(
        User.active == True,
        User.role == UserRole.CONTROLLER,
    ).all()
    for reviewer in reviewers:
        if s.location_id not in (reviewer.location_ids or []):
            continue
        send_submission_pending_background(
            background,
            reviewer_email=reviewer.email,
            reviewer_name=reviewer.name,
            operator_name=s.operator_name,
            location_name=s.location_name,
            submission_date=s.submission_date,
            total_cash=_fmt_currency(s.total_cash),
            variance=_fmt_currency(s.variance),
            variance_exception=s.variance_exception,
        )

    return _to_out(s)


# ── Approve ───────────────────────────────────────────────────────────────────

@router.post("/submissions/{submission_id}/approve", response_model=ApproveResponse)
def approve_submission(
    submission_id: str,
    body: ApproveBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Not authorised to approve submissions")

    s = db.get(Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    if current_user.role == UserRole.CONTROLLER and s.location_id not in (current_user.location_ids or []):
        raise HTTPException(404, "Submission not found")
    if s.status != SubmissionStatus.PENDING_APPROVAL:
        raise HTTPException(400, "Submission is not pending approval")

    now = datetime.now(timezone.utc)
    s.status = SubmissionStatus.APPROVED
    s.approved_by = current_user.id
    s.approved_by_name = current_user.name
    s.approved_at = now
    log_event(db, current_user, "SUBMISSION_APPROVED",
              f"Submission approved for {s.location_name} on {s.submission_date}",
              location_id=s.location_id, location_name=s.location_name,
              entity_id=s.id, entity_type="Submission")
    db.commit()
    db.refresh(s)

    # N-03: Notify operator
    operator = db.get(User, s.operator_id)
    if operator:
        send_submission_approved_background(
            background,
            operator_email=operator.email,
            operator_name=operator.name,
            location_name=s.location_name,
            submission_date=s.submission_date,
            total_cash=_fmt_currency(s.total_cash),
            approved_by_name=current_user.name,
        )

    return ApproveResponse(
        id=s.id,
        status=s.status.value,
        approved_by=s.approved_by,
        approved_by_name=s.approved_by_name,
        approved_at=s.approved_at.isoformat(),
    )


# ── Reject ────────────────────────────────────────────────────────────────────

@router.post("/submissions/{submission_id}/reject", response_model=ApproveResponse)
def reject_submission(
    submission_id: str,
    body: RejectBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Not authorised to reject submissions")

    s = db.get(Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    if current_user.role == UserRole.CONTROLLER and s.location_id not in (current_user.location_ids or []):
        raise HTTPException(404, "Submission not found")
    if s.status != SubmissionStatus.PENDING_APPROVAL:
        raise HTTPException(400, "Submission is not pending approval")

    now = datetime.now(timezone.utc)
    s.status = SubmissionStatus.REJECTED
    s.approved_by = current_user.id
    s.approved_by_name = current_user.name
    s.approved_at = now
    s.rejection_reason = body.reason
    log_event(db, current_user, "SUBMISSION_REJECTED",
              f"Submission rejected for {s.location_name} on {s.submission_date}: {body.reason}",
              location_id=s.location_id, location_name=s.location_name,
              entity_id=s.id, entity_type="Submission")
    db.commit()
    db.refresh(s)

    # N-04: Notify operator
    operator = db.get(User, s.operator_id)
    if operator:
        send_submission_rejected_background(
            background,
            operator_email=operator.email,
            operator_name=operator.name,
            location_name=s.location_name,
            submission_date=s.submission_date,
            rejected_by_name=current_user.name,
            rejection_reason=body.reason,
        )

    return ApproveResponse(
        id=s.id,
        status=s.status.value,
        approved_by=s.approved_by,
        approved_by_name=s.approved_by_name,
        approved_at=s.approved_at.isoformat(),
    )


# ── Missed submissions ────────────────────────────────────────────────────────

@router.post("/missed-submissions", response_model=MissedSubmissionOut, status_code=201)
def log_missed(
    body: CreateMissedBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, body.location_id)
    location_name = loc.name if loc else body.location_id

    m = MissedSubmission(
        location_id=body.location_id,
        missed_date=body.missed_date,
        reason=body.reason,
        detail=body.detail,
        supervisor_name=body.supervisor_name,
        logged_by=current_user.id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    # Notify the controller assigned to this location
    controller = db.query(User).filter(
        User.active == True,
        User.role == UserRole.CONTROLLER,
    ).all()
    for ctrl in controller:
        if body.location_id not in (ctrl.location_ids or []):
            continue
        send_missed_explanation_background(
            background,
            controller_email=ctrl.email,
            controller_name=ctrl.name,
            operator_name=current_user.name,
            location_name=location_name,
            missed_date=body.missed_date,
            reason=body.reason,
            detail=body.detail,
            supervisor_name=body.supervisor_name,
        )

    return MissedSubmissionOut(
        id=m.id,
        location_id=m.location_id,
        missed_date=m.missed_date,
        reason=m.reason,
        detail=m.detail,
        supervisor_name=m.supervisor_name,
        logged_at=m.logged_at.isoformat(),
    )


@router.get("/missed-submissions", response_model=PaginatedMissed)
def list_missed(
    location_id: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MissedSubmission)
    if location_id:
        q = q.filter(MissedSubmission.location_id == location_id)
    if date_from:
        q = q.filter(MissedSubmission.missed_date >= date_from)
    if date_to:
        q = q.filter(MissedSubmission.missed_date <= date_to)

    total = q.count()
    items = q.order_by(MissedSubmission.missed_date.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedMissed(
        items=[MissedSubmissionOut(
            id=m.id, location_id=m.location_id, missed_date=m.missed_date,
            reason=m.reason, detail=m.detail, supervisor_name=m.supervisor_name,
            logged_at=m.logged_at.isoformat(),
        ) for m in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )
