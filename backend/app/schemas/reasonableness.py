from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Sub-schemas
# ---------------------------------------------------------------------------

class RtLocReportSchema(BaseModel):
    loc_id: str
    loc_label: str
    total: float
    expected_fund: float
    actual_fund: float
    over: float
    cushion: float
    net: float
    status: str
    conclusion: str
    required_actions: str
    action_details: str


# ---------------------------------------------------------------------------
# Generate endpoint
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    location_ids: list[str]
    from_date: str
    to_date: str
    factor: float


class RtMaxValuesOut(BaseModel):
    loc_id: str
    loc_label: str
    max_f: float
    max_h: float
    max_j: float
    max_k: float
    total: float
    actual_fund: float
    section_a_data: list[dict]
    avg_sa: float
    count: int


class GenerateResponse(BaseModel):
    calculations: list[RtMaxValuesOut]


# ---------------------------------------------------------------------------
# Save / List / Detail
# ---------------------------------------------------------------------------

class SaveReportBody(BaseModel):
    group_key: str
    cost_center: str
    location_labels: str
    from_date: str
    to_date: str
    factor: float
    preparer: str
    scope: Optional[str] = None
    status: str
    location_reports: list[RtLocReportSchema]


class ReportOut(BaseModel):
    id: str
    group_key: str
    cost_center: str
    location_labels: str
    from_date: date
    to_date: date
    factor: float
    preparer: str
    scope: Optional[str]
    status: str
    location_reports: list[dict]
    saved_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedReports(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Location groups
# ---------------------------------------------------------------------------

class LocationGroupOut(BaseModel):
    group: str
    cost_center: str
    label: str
    sub_locs: list[dict]
    default_factor: float
