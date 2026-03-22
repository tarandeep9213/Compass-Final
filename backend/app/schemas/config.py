from pydantic import BaseModel
from typing import Literal, Optional


class GlobalConfigOut(BaseModel):
    default_tolerance_pct: float
    approval_sla_hours: int
    dow_lookback_weeks: Literal[4, 6]
    daily_reminder_time: str
    data_retention_years: int

    model_config = {"from_attributes": True}


class LocationOverrideOut(BaseModel):
    location_id: str
    tolerance_pct: float
    updated_at: str

    model_config = {"from_attributes": True}


class AdminConfigOut(BaseModel):
    global_config: GlobalConfigOut
    location_overrides: list[LocationOverrideOut]


class UpdateGlobalConfigBody(BaseModel):
    default_tolerance_pct: Optional[float] = None
    approval_sla_hours: Optional[int] = None
    dow_lookback_weeks: Optional[Literal[4, 6]] = None
    daily_reminder_time: Optional[str] = None
    data_retention_years: Optional[int] = None


class SetLocationOverrideBody(BaseModel):
    tolerance_pct: float
