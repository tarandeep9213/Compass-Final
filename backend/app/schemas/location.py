from pydantic import BaseModel
from typing import Optional


class LocationOut(BaseModel):
    id: str
    name: str
    cost_center: Optional[str] = None
    city: str
    address: str
    expected_cash: float = 0.0
    tolerance_pct_override: Optional[float] = None
    tolerance_pct: float = 5.0
    effective_tolerance_pct: float = 5.0
    sla_hours: int = 24
    has_override: bool = False
    active: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CreateLocationBody(BaseModel):
    name: str
    city: str = ""
    address: str = ""
    tolerance_pct_override: Optional[float] = None


class UpdateLocationBody(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    tolerance_pct_override: Optional[float] = None
    active: Optional[bool] = None
