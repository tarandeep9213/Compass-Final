"""Pydantic schemas for closure_records."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator

from app.core.business_days import is_business_day
from app.models.closure import ClosureReason


class CreateClosureBody(BaseModel):
    location_id: str
    closure_date: str  # YYYY-MM-DD
    reason: ClosureReason
    notes: str = ""

    @field_validator("closure_date")
    @classmethod
    def _validate_business_day(cls, v: str) -> str:
        try:
            d = date.fromisoformat(v)
        except ValueError as e:
            raise ValueError(f"closure_date must be YYYY-MM-DD, got {v!r}") from e
        if not is_business_day(d):
            raise ValueError(
                f"closure_date must be a weekday (Mon-Fri); {v} is a {d.strftime('%A')}"
            )
        return v

    @model_validator(mode="after")
    def _notes_required_if_other(self) -> "CreateClosureBody":
        if self.reason == ClosureReason.OTHER and not self.notes.strip():
            raise ValueError("notes are required when reason is OTHER")
        return self


class ClosureOut(BaseModel):
    id: str
    location_id: str
    location_name: str
    closure_date: str
    reason: ClosureReason
    notes: str
    reported_by_id: str
    reported_by_name: str
    reported_at: datetime

    model_config = {"from_attributes": True}


class PaginatedClosures(BaseModel):
    items: list[ClosureOut]
    total: int
