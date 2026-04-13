from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmComplianceRules
from app.api.v1.alarm_audit_helper import log_alarm_event
from app.schemas.alarm import AlarmComplianceRulesOut, UpdateAlarmComplianceRulesBody

router = APIRouter(prefix="/alarm/rules", tags=["alarm-rules"])

_ADMIN = [Depends(require_roles(UserRole.ALARM_ADMIN))]
_READER = [Depends(require_roles(
    UserRole.ALARM_TESTER, UserRole.ALARM_APPROVER, UserRole.ALARM_ADMIN,
    UserRole.CONTROLLER, UserRole.DGM, UserRole.REGIONAL_CONTROLLER,
))]


def _get_or_create(db: Session) -> AlarmComplianceRules:
    """Get the singleton rules record, creating with defaults if missing."""
    rules = db.get(AlarmComplianceRules, 1)
    if not rules:
        rules = AlarmComplianceRules(id=1)
        db.add(rules)
        db.commit()
        db.refresh(rules)
    return rules


@router.get("", response_model=AlarmComplianceRulesOut, dependencies=_READER)
def get_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_or_create(db)


@router.put("", response_model=AlarmComplianceRulesOut, dependencies=_ADMIN)
def update_rules(
    body: UpdateAlarmComplianceRulesBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = _get_or_create(db)

    for field, value in body.model_dump(exclude_unset=True).items():
        if field in ("escalation", "biannual", "notifications") and value is not None:
            # Convert pydantic model to dict for JSON column
            setattr(rules, field, value if isinstance(value, dict) else value)
        else:
            setattr(rules, field, value)

    changed = list(body.model_dump(exclude_unset=True).keys())
    log_alarm_event(db, current_user, "RULES_UPDATED", "config", f"Compliance rules updated: {', '.join(changed)}")
    db.commit()
    db.refresh(rules)
    return rules
