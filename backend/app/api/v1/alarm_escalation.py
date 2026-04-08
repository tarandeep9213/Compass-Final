from datetime import date as dt_date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmBuilding, AlarmTest, AlarmComplianceRules

router = APIRouter(prefix="/alarm/escalation", tags=["alarm-escalation"])

_ADMIN = [Depends(require_roles(UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER))]


class OverdueBuildingOut(BaseModel):
    building_id: str
    building_name: str
    region: str
    days_since_last_test: int
    assigned_testers: list[str]
    escalation_tier: int = 1


class SendReminderBody(BaseModel):
    building_id: str
    tier: int = 1


class SendReminderResponse(BaseModel):
    sent: bool
    building_id: str
    tier: int


@router.get("/overdue", response_model=list[OverdueBuildingOut])
def get_overdue_buildings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = dt_date.today()
    current_month = f"{today.year}-{today.month:02d}"

    # Load escalation thresholds from rules
    rules = db.get(AlarmComplianceRules, 1)
    if not rules:
        rules = AlarmComplianceRules(id=1)
        db.add(rules)
        db.commit()
        db.refresh(rules)

    esc = rules.escalation or {}
    tier2_days = esc.get("tier2", {}).get("days_after", 0)
    tier3_days = esc.get("tier3", {}).get("days_after", 3)
    deadline_day = rules.monthly_deadline_day or 28

    # Active buildings only
    buildings = db.query(AlarmBuilding).filter(AlarmBuilding.status == "active").all()

    # All approved tests for current month
    approved_tests = db.query(AlarmTest).filter(
        AlarmTest.test_month == current_month,
        AlarmTest.status == "APPROVED",
    ).all()
    approved_building_ids = {t.building_id for t in approved_tests}

    overdue = []
    for b in buildings:
        if b.id in approved_building_ids:
            continue

        # Find last approved test for this building
        last_approved = db.query(AlarmTest).filter(
            AlarmTest.building_id == b.id,
            AlarmTest.status == "APPROVED",
        ).order_by(AlarmTest.test_date.desc()).first()

        if last_approved:
            days_since = (today - dt_date.fromisoformat(last_approved.test_date)).days
        else:
            days_since = 999

        # Determine tier based on days since last test and rules thresholds
        # tier2_days = days after deadline to escalate to tier 2
        # tier3_days = days after deadline to escalate to tier 3
        # For buildings that have been tested before, use days_since_last_test - 30 as "days overdue"
        # For never-tested buildings (999), always tier 3
        if days_since == 999:
            tier = 3
        else:
            # How many days past the expected monthly cycle (approx 30 days)
            overdue_days = max(0, days_since - 30)
            if tier3_days > 0 and overdue_days >= tier3_days:
                tier = 3
            elif overdue_days >= tier2_days:
                tier = 2
            else:
                tier = 1

        overdue.append(OverdueBuildingOut(
            building_id=b.id,
            building_name=b.name,
            region=b.region,
            days_since_last_test=days_since,
            assigned_testers=b.assigned_testers or [],
            escalation_tier=tier,
        ))

    return overdue


@router.post("/remind", response_model=SendReminderResponse, dependencies=_ADMIN)
def send_reminder(
    body: SendReminderBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # In production, this would send email/in-app notifications
    # For now, just log and return success
    return SendReminderResponse(
        sent=True,
        building_id=body.building_id,
        tier=body.tier,
    )
