import math
import csv
import io
from collections import defaultdict
from datetime import date as dtdate

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus
from app.models.verification import Verification, VerificationType, VerificationStatus

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
def get_report_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = db.query(Submission).filter(
        Submission.submission_date >= date_from,
        Submission.submission_date <= date_to,
        Submission.status != SubmissionStatus.DRAFT,
    ).all()

    approved   = sum(1 for s in subs if s.status == SubmissionStatus.APPROVED)
    rejected   = sum(1 for s in subs if s.status == SubmissionStatus.REJECTED)
    pending    = sum(1 for s in subs if s.status == SubmissionStatus.PENDING_APPROVAL)
    exceptions = sum(1 for s in subs if s.variance_exception)
    total      = len(subs)

    avg_var_pct = round(sum(abs(s.variance_pct) for s in subs) / max(total, 1), 2)

    ctrl_visits = db.query(Verification).filter(
        Verification.verification_type == VerificationType.CONTROLLER,
        Verification.verification_date >= date_from,
        Verification.verification_date <= date_to,
        Verification.status == VerificationStatus.COMPLETED,
    ).count()

    dgm_visits = db.query(Verification).filter(
        Verification.verification_type == VerificationType.DGM,
        Verification.verification_date >= date_from,
        Verification.verification_date <= date_to,
        Verification.status == VerificationStatus.COMPLETED,
    ).count()

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_submissions": total,
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
        "approval_rate_pct": round(approved / max(total, 1) * 100, 1),
        "variance_exceptions": exceptions,
        "avg_variance_pct": avg_var_pct,
        "controller_verifications": ctrl_visits,
        "dgm_visits": dgm_visits,
    }


@router.get("/locations")
def get_location_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = db.query(Submission).filter(
        Submission.submission_date >= date_from,
        Submission.submission_date <= date_to,
        Submission.status != SubmissionStatus.DRAFT,
    ).all()

    by_loc: dict = defaultdict(lambda: {"total": 0, "approved": 0, "rejected": 0,
                                         "exceptions": 0, "name": ""})
    for s in subs:
        r = by_loc[s.location_id]
        r["name"] = s.location_name
        r["total"] += 1
        if s.status == SubmissionStatus.APPROVED:
            r["approved"] += 1
        elif s.status == SubmissionStatus.REJECTED:
            r["rejected"] += 1
        if s.variance_exception:
            r["exceptions"] += 1

    items = [{"location_id": lid, **data} for lid, data in by_loc.items()]
    items.sort(key=lambda x: x["name"])
    total = len(items)
    paginated = items[(page - 1) * page_size: page * page_size]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/actors")
def get_actor_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    role: str = Query("OPERATOR"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = db.query(Submission).filter(
        Submission.submission_date >= date_from,
        Submission.submission_date <= date_to,
        Submission.status != SubmissionStatus.DRAFT,
    ).all()

    by_op: dict = defaultdict(lambda: {"total": 0, "approved": 0, "rejected": 0,
                                        "exceptions": 0, "name": ""})
    for s in subs:
        r = by_op[s.operator_id]
        r["name"] = s.operator_name
        r["total"] += 1
        if s.status == SubmissionStatus.APPROVED: r["approved"] += 1
        elif s.status == SubmissionStatus.REJECTED: r["rejected"] += 1
        if s.variance_exception: r["exceptions"] += 1

    items = [{"actor_id": aid, **data} for aid, data in by_op.items()]
    items.sort(key=lambda x: x["name"])
    total = len(items)

    return {
        "role": role,
        "items": items[(page - 1) * page_size: page * page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/exceptions")
def get_exception_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Submission).filter(
        Submission.submission_date >= date_from,
        Submission.submission_date <= date_to,
        Submission.variance_exception == True,
        Submission.status != SubmissionStatus.DRAFT,
    )
    total = q.count()
    items = q.order_by(Submission.submission_date.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [{
            "id": s.id, "location_id": s.location_id, "location_name": s.location_name,
            "operator_name": s.operator_name, "submission_date": s.submission_date,
            "total_cash": s.total_cash, "variance": s.variance,
            "variance_pct": round(s.variance_pct, 2), "status": s.status.value,
            "variance_note": s.variance_note,
        } for s in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/section-trends")
def get_section_trends(
    section: str = Query(...),
    granularity: str = Query("monthly"),
    periods: int = Query(6, ge=1, le=24),
    location_id: str | None = Query(None),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Submission).filter(
        Submission.status == SubmissionStatus.APPROVED,
    )
    if location_id:
        q = q.filter(Submission.location_id == location_id)

    subs = q.all()

    def _period_key(date_str: str) -> str:
        d = dtdate.fromisoformat(date_str)
        if granularity == "weekly":
            iso = d.isocalendar()
            return f"{iso[0]}-W{iso[1]:02d}"
        elif granularity == "quarterly":
            q_num = (d.month - 1) // 3 + 1
            return f"{d.year}-Q{q_num}"
        else:  # monthly
            return date_str[:7]

    bucket: dict = defaultdict(list)
    for s in subs:
        pkey = _period_key(s.submission_date)
        if section == "K":
            bucket[pkey].append(float(s.total_cash))
        elif section == "L":
            bucket[pkey].append(float(s.variance))
        else:
            sec = s.sections.get(section, {})
            if isinstance(sec, dict) and "total" in sec:
                bucket[pkey].append(float(sec["total"]))

    all_periods = sorted(bucket.keys(), reverse=True)[:periods]
    all_periods = sorted(all_periods)

    data = [{"period": p, "avg_total": round(sum(bucket[p]) / len(bucket[p]), 2)}
            for p in all_periods]

    values = [d["avg_total"] for d in data]
    latest = values[-1] if values else 0.0
    prev   = values[-2] if len(values) >= 2 else 0.0
    peak   = max(values) if values else 0.0
    avg    = round(sum(values) / len(values), 2) if values else 0.0
    chg    = round((latest - prev) / prev * 100, 1) if prev else 0.0

    return {
        "section": section,
        "granularity": granularity,
        "location_id": location_id,
        "data": data,
        "summary": {
            "latest_value": latest,
            "previous_value": prev,
            "change_pct": chg,
            "period_avg": avg,
            "peak": peak,
        },
    }


@router.get("/export")
def export_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = db.query(Submission).filter(
        Submission.submission_date >= date_from,
        Submission.submission_date <= date_to,
        Submission.status != SubmissionStatus.DRAFT,
    ).order_by(Submission.submission_date).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Location", "Operator", "Status",
                     "Total Cash", "Variance", "Variance %", "Exception"])
    for s in subs:
        writer.writerow([
            s.submission_date, s.location_name, s.operator_name,
            s.status.value, f"{s.total_cash:.2f}", f"{s.variance:.2f}",
            f"{s.variance_pct:.2f}", "Yes" if s.variance_exception else "No",
        ])

    output.seek(0)
    filename = f"cashroom_report_{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
