from pydantic import BaseModel
from typing import Optional


class VerificationOut(BaseModel):
    id: str
    verification_type: str
    location_id: str
    location_name: str
    verifier_id: str
    verifier_name: str
    verification_date: str
    scheduled_time: Optional[str]
    day_of_week: int
    day_name: str
    status: str
    warning_flag: bool
    warning_reason: Optional[str]
    observed_total: Optional[float]
    variance_vs_imprest: Optional[float]
    variance_pct: Optional[float]
    notes: str
    missed_reason: Optional[str]
    month_year: Optional[str]
    signature_data: Optional[str]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PaginatedVerifications(BaseModel):
    items: list[VerificationOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class DowCheckResponse(BaseModel):
    warning: bool
    day_name: Optional[str] = None
    match_count: Optional[int] = None
    previous_dates: Optional[list[str]] = None
    lookback_weeks: Optional[int] = None


class ScheduleControllerBody(BaseModel):
    location_id: str
    date: str
    scheduled_time: str
    dow_warning_acknowledged: bool = False
    dow_warning_reason: Optional[str] = None
    notes: Optional[str] = None


class ScheduleDgmBody(BaseModel):
    location_id: str
    date: str
    notes: Optional[str] = None


class CompleteVerificationBody(BaseModel):
    observed_total: float = 0.0
    signature_data: str
    notes: Optional[str] = None
    dow_warning_reason: Optional[str] = None


class MissVerificationBody(BaseModel):
    missed_reason: str
    notes: Optional[str] = None
