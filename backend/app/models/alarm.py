import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Float, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AlarmBuilding(Base):
    __tablename__ = "alarm_buildings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    security_company_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    security_customer_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    security_company_phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")  # active, temporarily_exempt, closed
    exempt_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_testers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    assigned_approver: Mapped[str] = mapped_column(String(36), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AlarmZone(Base):
    __tablename__ = "alarm_zones"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    building_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    zone_number: Mapped[int] = mapped_column(Integer, nullable=False)
    zone_name: Mapped[str] = mapped_column(String(200), nullable=False)
    zone_type: Mapped[str] = mapped_column(String(30), nullable=False)  # ENTRY_EXIT, INTERIOR_MOTION, PANIC_SILENT, HOLDUP, FIRE_SMOKE, OTHER
    area_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    other_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AlarmTest(Base):
    __tablename__ = "alarm_tests"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    building_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    test_date: Mapped[str] = mapped_column(String(10), nullable=False)
    test_month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    tester_id: Mapped[str] = mapped_column(String(36), nullable=False)
    tester_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")  # DRAFT, SUBMITTED, APPROVED, REJECTED
    test_start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    test_end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    zones_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    zones_tested: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    zones_issue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submitted_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    approved_by_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    approved_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AlarmTestZone(Base):
    __tablename__ = "alarm_test_zones"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    alarm_test_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    alarm_zone_id: Mapped[str] = mapped_column(String(36), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # TESTED, NOT_TESTED, ISSUE_FOUND
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class AlarmAccessGrant(Base):
    __tablename__ = "alarm_access_grants"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    access_type: Mapped[str] = mapped_column(String(20), nullable=False)  # tester, approver
    building_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class AlarmAuditEvent(Base):
    __tablename__ = "alarm_audit_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # access, building, testing, config
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    details: Mapped[str] = mapped_column(Text, nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False, index=True)


# Default escalation/biannual/notification config stored as JSON
_DEFAULT_ESCALATION = {
    "tier1": {"days_before": 7, "recipients": ["tester"]},
    "tier2": {"days_after": 0, "recipients": ["tester", "approver"]},
    "tier3": {"days_after": 3, "recipients": ["tester", "approver", "regional"]},
}

_DEFAULT_BIANNUAL = {
    "cellular_frequency_months": 6,
    "camera_check_frequency_days": 30,
    "reminder_days_before": 30,
    "escalation": {
        "tier1": {"days_overdue": 7, "recipients": ["tester", "approver"]},
        "tier2": {"days_overdue": 14, "recipients": ["tester", "approver", "regional"]},
        "tier3": {"days_overdue": 30, "recipients": ["tester", "approver", "regional", "dgm"]},
    },
}

_DEFAULT_NOTIFICATIONS = {"enable_email": True, "enable_in_app": True}


class AlarmComplianceRules(Base):
    __tablename__ = "alarm_compliance_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    monthly_deadline_day: Mapped[int] = mapped_column(Integer, nullable=False, default=28)
    approval_sla_days: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    require_all_zones_tested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    require_report_upload: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    require_approver_signoff: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    escalation: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: _DEFAULT_ESCALATION.copy())
    biannual: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: _DEFAULT_BIANNUAL.copy())
    notifications: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: _DEFAULT_NOTIFICATIONS.copy())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
