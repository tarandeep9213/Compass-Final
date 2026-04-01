"""
Cash Reasonableness Test — API routes and calculation helpers.

Business logic (compute_max_values, compute_net_result) is exposed as
module-level functions so they can be unit-tested without HTTP.
"""
import math
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus
from app.models.reasonableness import ReasonablenessReport, ReasonablenessStatus
from app.schemas.reasonableness import (
    GenerateRequest,
    GenerateResponse,
    RtMaxValuesOut,
    SaveReportBody,
    ReportOut,
    PaginatedReports,
    LocationGroupOut,
)

router = APIRouter(prefix="/reasonableness", tags=["Reasonableness"])

DEFAULT_CUSHION = -5000.0


# ---------------------------------------------------------------------------
# Pure calculation helpers (no DB, no HTTP — unit-testable)
# ---------------------------------------------------------------------------

def compute_max_values(submissions: list[dict]) -> dict:
    """
    Given a list of submission-like dicts (with 'sections' JSON and 'total_cash'),
    extract the maximum of each section line and Section A daily data.

    Each submission dict must have:
      - sections: dict with keys like "F", "H", "J", "A" each containing {"total": N}
      - total_cash: float
      - submission_date (optional): str "YYYY-MM-DD" for Section A data

    Returns dict with: max_f, max_h, max_j, max_k, total, actual_fund,
                       section_a_data, avg_sa, count
    """
    if not submissions:
        return {
            "max_f": 0.0, "max_h": 0.0, "max_j": 0.0, "max_k": 0.0,
            "total": 0.0, "actual_fund": 0.0,
            "section_a_data": [], "avg_sa": 0.0, "count": 0,
        }

    def _sec_total(sub: dict, key: str) -> float:
        sec = sub.get("sections", {}).get(key, {})
        if isinstance(sec, dict):
            return float(sec.get("total", 0))
        return 0.0

    max_f = max(_sec_total(s, "F") for s in submissions)
    max_h = max(_sec_total(s, "H") for s in submissions)
    max_j = max(_sec_total(s, "J") for s in submissions)
    max_k = 0.0  # K defaults to 0 per spec
    total = max_f + max_h + max_j + max_k

    actual_fund = max(float(s.get("total_cash", 0)) for s in submissions)

    # Section A daily data
    section_a_data = []
    for s in submissions:
        sa_val = _sec_total(s, "A")
        d = s.get("submission_date", "")
        if d:
            section_a_data.append({"date": d, "sA": sa_val})

    avg_sa = 0.0
    if section_a_data:
        avg_sa = sum(e["sA"] for e in section_a_data) / len(section_a_data)

    return {
        "max_f": max_f,
        "max_h": max_h,
        "max_j": max_j,
        "max_k": max_k,
        "total": total,
        "actual_fund": actual_fund,
        "section_a_data": section_a_data,
        "avg_sa": avg_sa,
        "count": len(section_a_data),
    }


def compute_net_result(
    total: float,
    factor: float,
    actual_fund: float,
    cushion: float = DEFAULT_CUSHION,
) -> dict:
    """
    Compute expected fund, over/under, net result, and status.

    Formula:
      expected = total * factor
      over     = actual_fund - expected
      net      = over + cushion
      status   = "Overfunded" if net > 0 else "Reasonable"
    """
    expected_fund = total * factor
    over = actual_fund - expected_fund
    net = over + cushion
    status = "Overfunded" if net > 0 else "Reasonable"
    return {
        "expected_fund": expected_fund,
        "over": over,
        "net": net,
        "status": status,
    }


# ---------------------------------------------------------------------------
# Helper: ORM → Pydantic
# ---------------------------------------------------------------------------

def _to_out(report: ReasonablenessReport) -> ReportOut:
    return ReportOut(
        id=report.id,
        group_key=report.group_key,
        cost_center=report.cost_center,
        location_labels=report.location_labels,
        from_date=report.from_date,
        to_date=report.to_date,
        factor=report.factor,
        preparer=report.preparer,
        scope=report.scope,
        status=report.status.value,
        location_reports=report.location_reports,
        saved_by=report.saved_by,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints (Phase 4 — will be wired after tests are written)
# ---------------------------------------------------------------------------

@router.get("/location-groups", response_model=list[LocationGroupOut])
def get_location_groups(
    current_user: User = Depends(require_roles(
        UserRole.CONTROLLER, UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER
    )),
    db: Session = Depends(get_db),
):
    """Return locations grouped by cost_center for the reasonableness test."""
    q = db.query(Location).filter(
        Location.active == True,  # noqa: E712
        Location.cost_center.isnot(None),
    )
    # Controllers see only their assigned locations
    if current_user.role == UserRole.CONTROLLER:
        q = q.filter(Location.id.in_(current_user.location_ids or []))

    locations = q.all()

    # Group by cost_center
    groups: dict[str, list[Location]] = {}
    for loc in locations:
        groups.setdefault(loc.cost_center, []).append(loc)

    result = []
    for cc, locs in sorted(groups.items()):
        label = " / ".join(l.name for l in locs)
        sub_locs = [
            {"id": l.id, "label": l.name, "imprest": l.expected_cash}
            for l in locs
        ]
        default_factor = 1.50 if len(locs) > 1 else 1.25
        result.append(LocationGroupOut(
            group=cc,
            cost_center=cc,
            label=label,
            sub_locs=sub_locs,
            default_factor=default_factor,
        ))
    return result


@router.post("/generate", response_model=GenerateResponse)
def generate_calculations(
    body: GenerateRequest,
    current_user: User = Depends(require_roles(UserRole.CONTROLLER)),
    db: Session = Depends(get_db),
):
    """Pull max values from approved submissions for each location in the date range."""
    if body.from_date > body.to_date:
        raise HTTPException(status_code=422, detail="from_date must be <= to_date")

    calculations = []
    for loc_id in body.location_ids:
        loc = db.get(Location, loc_id)
        if not loc:
            raise HTTPException(status_code=404, detail=f"Location {loc_id} not found")

        subs = (
            db.query(Submission)
            .filter(
                Submission.location_id == loc_id,
                Submission.status == SubmissionStatus.APPROVED,
                Submission.submission_date >= body.from_date,
                Submission.submission_date <= body.to_date,
            )
            .all()
        )

        # Convert ORM objects to dicts for compute_max_values
        sub_dicts = [
            {
                "sections": s.sections or {},
                "total_cash": s.total_cash,
                "submission_date": s.submission_date,
            }
            for s in subs
        ]
        maxvals = compute_max_values(sub_dicts)

        calculations.append(RtMaxValuesOut(
            loc_id=loc_id,
            loc_label=loc.name,
            max_f=maxvals["max_f"],
            max_h=maxvals["max_h"],
            max_j=maxvals["max_j"],
            max_k=maxvals["max_k"],
            total=maxvals["total"],
            actual_fund=maxvals["actual_fund"],
            section_a_data=maxvals["section_a_data"],
            avg_sa=maxvals["avg_sa"],
            count=maxvals["count"],
        ))

    return GenerateResponse(calculations=calculations)


@router.post("/reports", response_model=ReportOut, status_code=201)
def save_report(
    body: SaveReportBody,
    current_user: User = Depends(require_roles(UserRole.CONTROLLER)),
    db: Session = Depends(get_db),
):
    """Save a completed reasonableness report."""
    try:
        status = ReasonablenessStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}. Must be 'Reasonable' or 'Overfunded'.")

    report = ReasonablenessReport(
        id=str(uuid.uuid4()),
        group_key=body.group_key,
        cost_center=body.cost_center,
        location_labels=body.location_labels,
        from_date=date.fromisoformat(body.from_date),
        to_date=date.fromisoformat(body.to_date),
        factor=body.factor,
        preparer=body.preparer,
        scope=body.scope,
        status=status,
        location_reports=[lr.model_dump() for lr in body.location_reports],
        saved_by=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Audit log
    try:
        from app.services.audit import log_event
        log_event(
            db,
            actor=current_user,
            event_type="reasonableness_report_saved",
            detail=f"Saved reasonableness report: {body.location_labels} ({body.status})",
            entity_type="reasonableness_report",
            entity_id=report.id,
        )
        db.commit()
    except Exception:
        pass  # Audit logging is best-effort

    return _to_out(report)


@router.get("/reports", response_model=PaginatedReports)
def list_reports(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(
        UserRole.CONTROLLER, UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER
    )),
    db: Session = Depends(get_db),
):
    """List reasonableness reports with optional status filter and pagination."""
    q = db.query(ReasonablenessReport)

    if status:
        q = q.filter(ReasonablenessReport.status == ReasonablenessStatus(status))

    total = q.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        q.order_by(ReasonablenessReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedReports(
        items=[_to_out(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(
    report_id: str,
    current_user: User = Depends(require_roles(
        UserRole.CONTROLLER, UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER
    )),
    db: Session = Depends(get_db),
):
    """Get a single reasonableness report by ID."""
    report = db.get(ReasonablenessReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _to_out(report)
