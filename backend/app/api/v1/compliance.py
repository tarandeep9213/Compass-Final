from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus
from app.models.verification import Verification, VerificationType, VerificationStatus
from app.models.config import SystemConfig

router = APIRouter(prefix="/compliance", tags=["Compliance"])

TODAY = lambda: date.today().isoformat()  # noqa: E731


def _get_config(db: Session) -> SystemConfig:
    return db.get(SystemConfig, 1) or SystemConfig()


def _location_health(
    has_submission_today: bool,
    submission_status: str | None,
    variance_exception: bool,
    days_since_controller: int | None,
    sla_hours: int,
) -> str:
    if not has_submission_today:
        return "red"
    if submission_status == "rejected":
        return "red"
    if variance_exception:
        return "amber"
    if submission_status == "pending_approval":
        # Check if overdue based on SLA
        return "amber"
    if days_since_controller is not None and days_since_controller > 30:
        return "amber"
    return "green"


@router.get("/dashboard")
def get_compliance_dashboard(
    sort: str = Query("status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = TODAY()
    cfg = _get_config(db)

    # Determine which locations to show
    q = db.query(Location).filter(Location.active == True)
    if current_user.role == UserRole.CONTROLLER:
        if current_user.location_ids:
            q = q.filter(Location.id.in_(current_user.location_ids))
    elif current_user.role == UserRole.OPERATOR:
        if current_user.location_ids:
            q = q.filter(Location.id.in_(current_user.location_ids))
    locations = q.all()

    location_rows = []
    total_green = total_amber = total_red = 0
    submitted_today = overdue = variance_exceptions = controller_issues = 0

    for loc in locations:
        # Today's submission
        today_sub = db.query(Submission).filter(
            Submission.location_id == loc.id,
            Submission.submission_date == today,
            Submission.status != SubmissionStatus.DRAFT,
        ).order_by(Submission.created_at.desc()).first()

        # Last approved controller visit
        last_ctrl = db.query(Verification).filter(
            Verification.location_id == loc.id,
            Verification.verification_type == VerificationType.CONTROLLER,
            Verification.status == VerificationStatus.COMPLETED,
        ).order_by(Verification.verification_date.desc()).first()

        # Next scheduled controller visit
        next_ctrl = db.query(Verification).filter(
            Verification.location_id == loc.id,
            Verification.verification_type == VerificationType.CONTROLLER,
            Verification.status == VerificationStatus.SCHEDULED,
            Verification.verification_date >= today,
        ).order_by(Verification.verification_date.asc()).first()

        # This month's DGM visit
        month_year = today[:7]
        dgm_visit = db.query(Verification).filter(
            Verification.location_id == loc.id,
            Verification.verification_type == VerificationType.DGM,
            Verification.month_year == month_year,
        ).order_by(Verification.created_at.desc()).first()

        # Submission rate last 30 days
        from datetime import date as dtdate, timedelta
        thirty_days_ago = (dtdate.today() - timedelta(days=30)).isoformat()
        total_30d = db.query(Submission).filter(
            Submission.location_id == loc.id,
            Submission.submission_date >= thirty_days_ago,
            Submission.status != SubmissionStatus.DRAFT,
        ).count()
        sub_rate_30d = round(min(total_30d / 30 * 100, 100), 1)

        # Days since last controller visit
        days_since_ctrl = None
        warning_flag = False
        if last_ctrl:
            days_since_ctrl = (dtdate.today() - dtdate.fromisoformat(last_ctrl.verification_date)).days
            warning_flag = last_ctrl.warning_flag

        # Determine health
        health = _location_health(
            has_submission_today=today_sub is not None,
            submission_status=today_sub.status.value if today_sub else None,
            variance_exception=today_sub.variance_exception if today_sub else False,
            days_since_controller=days_since_ctrl,
            sla_hours=cfg.approval_sla_hours,
        )

        # Tally summary counters
        if health == "green": total_green += 1
        elif health == "amber": total_amber += 1
        else: total_red += 1

        if today_sub:
            submitted_today += 1
            if today_sub.variance_exception:
                variance_exceptions += 1
        else:
            overdue += 1

        if days_since_ctrl is not None and days_since_ctrl > 30:
            controller_issues += 1

        location_rows.append({
            "id": loc.id,
            "name": loc.name,
            "health": health,
            "submission": {
                "status": today_sub.status.value,
                "total_cash": today_sub.total_cash,
                "variance": today_sub.variance,
                "variance_pct": today_sub.variance_pct,
                "submitted_at": today_sub.submitted_at.isoformat() if today_sub.submitted_at else None,
            } if today_sub else None,
            "submission_rate_30d": sub_rate_30d,
            "controller_visit": {
                "last_date": last_ctrl.verification_date if last_ctrl else None,
                "days_since": days_since_ctrl,
                "warning_flag": warning_flag,
                "next_scheduled_date": next_ctrl.verification_date if next_ctrl else None,
            },
            "dgm_visit": {
                "status": dgm_visit.status.value if dgm_visit else None,
                "visit_date": dgm_visit.verification_date if dgm_visit else None,
                "observed_total": dgm_visit.observed_total if dgm_visit else None,
            },
        })

    # Sort
    if sort == "name":
        location_rows.sort(key=lambda x: x["name"])
    else:
        order = {"red": 0, "amber": 1, "green": 2}
        location_rows.sort(key=lambda x: order.get(x["health"], 3))

    total_locs = len(locations)
    dgm_coverage = round(
        db.query(Verification).filter(
            Verification.verification_type == VerificationType.DGM,
            Verification.month_year == today[:7],
            Verification.status == VerificationStatus.COMPLETED,
        ).count() / max(total_locs, 1) * 100, 1
    )

    return {
        "generated_at": date.today().isoformat(),
        "summary": {
            "overall_compliance_pct": round(total_green / max(total_locs, 1) * 100, 1),
            "submitted_today": submitted_today,
            "total_locations": total_locs,
            "overdue_count": overdue,
            "variance_exceptions_today": variance_exceptions,
            "controller_issues": controller_issues,
            "dgm_coverage_this_month": dgm_coverage,
        },
        "locations": location_rows,
    }
