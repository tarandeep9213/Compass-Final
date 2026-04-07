from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlarmBuildingOut(BaseModel):
    id: str
    name: str
    region: str
    security_company_name: str
    security_customer_id: str
    security_company_phone: str
    status: str
    exempt_reason: Optional[str]
    assigned_testers: list[str]
    assigned_approver: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateAlarmBuildingBody(BaseModel):
    name: str
    region: str = ""
    security_company_name: str = ""
    security_customer_id: str = ""
    security_company_phone: str = ""
    status: str = "active"
    exempt_reason: Optional[str] = None
    assigned_testers: list[str] = []
    assigned_approver: str = ""


class UpdateAlarmBuildingBody(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    security_company_name: Optional[str] = None
    security_customer_id: Optional[str] = None
    security_company_phone: Optional[str] = None
    status: Optional[str] = None
    exempt_reason: Optional[str] = None
    assigned_testers: Optional[list[str]] = None
    assigned_approver: Optional[str] = None


class ImportBuildingsBody(BaseModel):
    buildings: list[CreateAlarmBuildingBody]


class ImportBuildingsResponse(BaseModel):
    imported: int
    buildings: list[AlarmBuildingOut]


class ResetResponse(BaseModel):
    deleted: int


# ── Zone schemas ─────────────────────────────────────────────────────────────

class AlarmZoneOut(BaseModel):
    id: str
    building_id: str
    zone_number: int
    zone_name: str
    zone_type: str
    area_number: int
    is_active: bool
    other_description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateAlarmZoneBody(BaseModel):
    building_id: str
    zone_number: int
    zone_name: str
    zone_type: str
    area_number: int = 1
    is_active: bool = True
    other_description: Optional[str] = None


class UpdateAlarmZoneBody(BaseModel):
    zone_number: Optional[int] = None
    zone_name: Optional[str] = None
    zone_type: Optional[str] = None
    area_number: Optional[int] = None
    is_active: Optional[bool] = None
    other_description: Optional[str] = None


class ImportZonesBody(BaseModel):
    zones: list[CreateAlarmZoneBody]


class ImportZonesResponse(BaseModel):
    imported: int
    zones: list[AlarmZoneOut]


# ── Compliance Rules schemas ─────────────────────────────────────────────────

class EscalationTierMonthly(BaseModel):
    days_before: Optional[int] = None
    days_after: Optional[int] = None
    recipients: list[str] = []

class MonthlyEscalation(BaseModel):
    tier1: EscalationTierMonthly
    tier2: EscalationTierMonthly
    tier3: EscalationTierMonthly

class BiannualEscalationTier(BaseModel):
    days_overdue: int
    recipients: list[str] = []

class BiannualEscalation(BaseModel):
    tier1: BiannualEscalationTier
    tier2: BiannualEscalationTier
    tier3: BiannualEscalationTier

class BiannualConfig(BaseModel):
    cellular_frequency_months: int = 6
    camera_check_frequency_days: int = 30
    reminder_days_before: int = 30
    escalation: BiannualEscalation

class NotificationConfig(BaseModel):
    enable_email: bool = True
    enable_in_app: bool = True

class AlarmComplianceRulesOut(BaseModel):
    monthly_deadline_day: int
    approval_sla_days: int
    require_all_zones_tested: bool
    require_report_upload: bool
    require_approver_signoff: bool
    escalation: MonthlyEscalation
    biannual: BiannualConfig
    notifications: NotificationConfig
    updated_at: datetime

    model_config = {"from_attributes": True}

class UpdateAlarmComplianceRulesBody(BaseModel):
    monthly_deadline_day: Optional[int] = None
    approval_sla_days: Optional[int] = None
    require_all_zones_tested: Optional[bool] = None
    require_report_upload: Optional[bool] = None
    require_approver_signoff: Optional[bool] = None
    escalation: Optional[MonthlyEscalation] = None
    biannual: Optional[BiannualConfig] = None
    notifications: Optional[NotificationConfig] = None
