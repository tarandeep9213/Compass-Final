from pydantic import BaseModel, field_validator
from typing import Optional, Any
from datetime import datetime, timezone


class SubmissionOut(BaseModel):
    id: str
    location_id: str
    location_name: str
    operator_id: str
    operator_name: str
    submission_date: str
    status: str
    source: str
    total_cash: float
    expected_cash: float
    variance: float
    variance_pct: float
    variance_exception: bool
    variance_note: Optional[str]
    approved_by: Optional[str]
    approved_by_name: Optional[str]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", "updated_at", "submitted_at", "approved_at", mode="after")
    @classmethod
    def force_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class SubmissionDetailOut(SubmissionOut):
    sections: dict[str, Any]


class PaginatedSubmissions(BaseModel):
    items: list[SubmissionOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateSubmissionBody(BaseModel):
    location_id: str
    submission_date: str
    source: str = "FORM"
    sections: dict[str, Any] = {}
    variance_note: Optional[str] = None
    save_as_draft: bool = False


class SubmitBody(BaseModel):
    variance_note: Optional[str] = None


class ApproveBody(BaseModel):
    notes: Optional[str] = None


class RejectBody(BaseModel):
    reason: str


class ApproveResponse(BaseModel):
    id: str
    status: str
    approved_by: str
    approved_by_name: str
    approved_at: datetime


class MissedSubmissionOut(BaseModel):
    id: str
    location_id: str
    missed_date: str
    reason: str
    detail: str
    supervisor_name: str
    logged_at: datetime

    model_config = {"from_attributes": True}


class PaginatedMissed(BaseModel):
    items: list[MissedSubmissionOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateMissedBody(BaseModel):
    location_id: str
    missed_date: str
    reason: str
    detail: str = ""
    supervisor_name: str
