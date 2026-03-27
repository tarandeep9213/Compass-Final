"""Business Dashboard aggregate endpoints for the RC executive view."""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus, SubmissionSource
from app.models.verification import Verification, VerificationType, VerificationStatus

router = APIRouter(prefix="/business-dashboard", tags=["Business Dashboard"])


@router.get("/controller-activity")
def get_controller_activity(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-controller aggregated verification stats for the current month."""
    today = date.today()
    start_of_month = date(today.year, today.month, 1).isoformat()

    verifs = db.query(Verification).filter(
        Verification.verification_type == VerificationType.CONTROLLER,
        Verification.verification_date >= start_of_month,
        Verification.verification_date <= today.isoformat(),
    ).all()

    by_ctrl: dict = defaultdict(lambda: {
        "name": "",
        "completed": 0,
        "missed": 0,
        "scheduled": 0,
        "variances": [],
        "warning_count": 0,
    })

    for v in verifs:
        c = by_ctrl[v.verifier_id]
        c["name"] = v.verifier_name
        if v.status == VerificationStatus.COMPLETED:
            c["completed"] += 1
            if v.variance_vs_imprest is not None:
                c["variances"].append(abs(v.variance_vs_imprest))
        elif v.status == VerificationStatus.MISSED:
            c["missed"] += 1
        elif v.status == VerificationStatus.SCHEDULED:
            c["scheduled"] += 1
        if v.warning_flag:
            c["warning_count"] += 1

    items = []
    for ctrl in by_ctrl.values():
        completed = ctrl["completed"]
        missed = ctrl["missed"]
        evaluated = completed + missed
        variances = ctrl["variances"]
        items.append({
            "name": ctrl["name"],
            "completed": completed,
            "missed": missed,
            "scheduled": ctrl["scheduled"],
            "completionRate": round(completed / evaluated * 100) if evaluated > 0 else 100,
            "avgVarianceFound": round(sum(variances) / len(variances), 2) if variances else 0,
            "dowWarnings": ctrl["warning_count"],
        })

    items.sort(key=lambda x: x["completionRate"])  # worst first

    return {
        "month_year": today.strftime("%Y-%m"),
        "items": items,
    }


@router.get("/operator-behaviour")
def get_operator_behaviour(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Operator submission timing, platform usage, and draft behaviour for current month."""
    today = date.today()
    start_of_month = date(today.year, today.month, 1).isoformat()

    subs = db.query(Submission).filter(
        Submission.submission_date >= start_of_month,
        Submission.submission_date <= today.isoformat(),
        Submission.status != SubmissionStatus.DRAFT,
    ).all()

    total = len(subs)

    # Avg hours to submit (submitted_at - 09:00 on submission_date)
    hours_list = []
    late_operators = set()
    for s in subs:
        if not s.submitted_at or not s.submission_date:
            continue
        from datetime import datetime, time, timezone
        sub_date = s.submission_date if isinstance(s.submission_date, date) else date.fromisoformat(str(s.submission_date))
        shift_start = datetime.combine(sub_date, time(9, 0), tzinfo=timezone.utc)
        submitted = s.submitted_at if s.submitted_at.tzinfo else s.submitted_at.replace(tzinfo=timezone.utc)
        hrs = (submitted - shift_start).total_seconds() / 3600
        if hrs > 0:
            hours_list.append(hrs)
        # Late = submitted after 18:00 or on a different date
        if submitted.hour >= 18 or submitted.date() != sub_date:
            late_operators.add(s.operator_id)

    avg_hours = round(sum(hours_list) / max(len(hours_list), 1), 1)

    # Platform split
    form_count = sum(1 for s in subs if s.source == SubmissionSource.FORM)
    excel_count = sum(1 for s in subs if s.source == SubmissionSource.EXCEL)

    # Draft usage: submissions where created_at is significantly before submitted_at (>10 min gap = was a draft)
    draft_count = 0
    for s in subs:
        if s.submitted_at and s.created_at:
            gap = (s.submitted_at - s.created_at).total_seconds()
            if gap > 600:  # more than 10 minutes
                draft_count += 1

    return {
        "month_year": today.strftime("%Y-%m"),
        "total_submissions": total,
        "avgHoursToSubmit": avg_hours,
        "lateSubmitters": len(late_operators),
        "platformSplit": {
            "form": round(form_count / max(total, 1) * 100),
            "excel": round(excel_count / max(total, 1) * 100),
        },
        "draftUsageRate": round(draft_count / max(total, 1) * 100),
    }


@router.get("/rejections")
def get_rejections(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rejection patterns: top rejected operators, rejection reasons, avg rejections before approval."""
    today = date.today()
    start_of_month = date(today.year, today.month, 1).isoformat()

    rejected_subs = db.query(Submission).filter(
        Submission.submission_date >= start_of_month,
        Submission.submission_date <= today.isoformat(),
        Submission.status == SubmissionStatus.REJECTED,
    ).all()

    # Per-operator rejection count
    by_operator: dict = defaultdict(lambda: {"name": "", "location": "", "count": 0, "reasons": []})
    reason_counts: dict = defaultdict(int)

    for s in rejected_subs:
        op = by_operator[s.operator_id]
        op["name"] = s.operator_name
        op["location"] = s.location_name
        op["count"] += 1
        reason = s.rejection_reason or "No reason given"
        op["reasons"].append(reason)
        reason_counts[reason] += 1

    # Top rejected operators (sorted by count desc)
    top_operators = sorted(by_operator.values(), key=lambda x: x["count"], reverse=True)[:5]
    operators_out = []
    for op in top_operators:
        # Most common reason for this operator
        from collections import Counter
        reason_counter = Counter(op["reasons"])
        top_reason = reason_counter.most_common(1)[0][0] if reason_counter else "—"
        operators_out.append({
            "name": op["name"],
            "location": op["location"],
            "rejections": op["count"],
            "topReason": top_reason,
        })

    # Top rejection reasons
    total_rejections = len(rejected_subs)
    reasons_out = []
    for reason, count in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:4]:
        reasons_out.append({
            "reason": reason,
            "count": count,
            "pct": round(count / max(total_rejections, 1) * 100),
        })

    # Avg rejections before approval (approximate: total rejections / unique operators who had rejections)
    unique_rejected_ops = len(by_operator)
    avg_rejections = round(total_rejections / max(unique_rejected_ops, 1), 1)

    return {
        "month_year": today.strftime("%Y-%m"),
        "total_rejections": total_rejections,
        "avgRejectionsBeforeApproval": avg_rejections,
        "repeatRejecters": sum(1 for op in by_operator.values() if op["count"] >= 3),
        "operators": operators_out,
        "reasons": reasons_out,
    }


@router.get("/dgm-coverage")
def get_dgm_coverage(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-DGM visit coverage for the current month + pending locations."""
    today = date.today()
    start_of_month = date(today.year, today.month, 1).isoformat()
    days_left = (date(today.year, today.month + 1 if today.month < 12 else 1, 1) - today).days if today.month < 12 else (date(today.year + 1, 1, 1) - today).days

    # All DGM verifications this month
    verifs = db.query(Verification).filter(
        Verification.verification_type == VerificationType.DGM,
        Verification.verification_date >= start_of_month,
        Verification.verification_date <= today.isoformat(),
    ).all()

    # All active locations
    from app.models.location import Location
    all_locs = db.query(Location).filter(Location.active == True).all()  # noqa: E712
    all_loc_ids = {l.id for l in all_locs}
    loc_names = {l.id: l.name for l in all_locs}

    # Group completed visits by DGM
    by_dgm: dict = defaultdict(lambda: {"name": "", "visited_ids": set(), "variances": []})
    for v in verifs:
        if v.status == VerificationStatus.COMPLETED:
            d = by_dgm[v.verifier_id]
            d["name"] = v.verifier_name
            d["visited_ids"].add(v.location_id)
            if v.variance_vs_imprest is not None:
                d["variances"].append(abs(v.variance_vs_imprest))

    # All visited location IDs across all DGMs
    all_visited = set()
    for d in by_dgm.values():
        all_visited |= d["visited_ids"]

    # Per-DGM output
    dgm_rows = []
    for dgm in by_dgm.values():
        visited = dgm["visited_ids"]
        # Assign all locations to each DGM (since DGMs cover all locations)
        assigned = len(all_loc_ids)
        variances = dgm["variances"]
        pending = [loc_names.get(lid, lid) for lid in all_loc_ids - visited]
        dgm_rows.append({
            "name": dgm["name"],
            "locationsAssigned": assigned,
            "locationsVisited": len(visited),
            "coveragePct": round(len(visited) / max(assigned, 1) * 100),
            "avgVarianceFound": round(sum(variances) / max(len(variances), 1), 2) if variances else 0,
            "pendingLocations": sorted(pending)[:10],  # cap at 10
        })

    dgm_rows.sort(key=lambda x: x["coveragePct"])  # worst coverage first

    # Pending locations (not visited by any DGM)
    pending_locs = []
    for lid in all_loc_ids - all_visited:
        pending_locs.append({
            "name": loc_names.get(lid, lid),
            "daysLeft": days_left,
        })
    pending_locs.sort(key=lambda x: x["name"])

    return {
        "month_year": today.strftime("%Y-%m"),
        "daysLeft": days_left,
        "dgms": dgm_rows,
        "pendingLocations": pending_locs,
    }
# reload trigger
