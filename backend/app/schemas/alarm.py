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
