from datetime import date as dt_date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.alarm import AlarmBuilding, AlarmTest, AlarmZone, AlarmBiannualCheck
from app.schemas.alarm import AlarmBuildingOut, AlarmTestOut, AlarmZoneOut, AlarmBiannualCheckOut

router = APIRouter(prefix="/alarm/dashboard", tags=["alarm-dashboard"])


# ── Response models ──────────────────────────────────────────────────────────

class OverviewSummary(BaseModel):
    total_buildings: int
    compliant: int
    pending_review: int
    overdue: int
    exempt: int
    compliance_rate: int


class BuildingComplianceRow(BaseModel):
    building_id: str
    building_name: str
    region: str
    status: str  # compliant, pending, overdue, exempt
    last_test_date: Optional[str] = None
    last_test_status: Optional[str] = None
    approver_name: Optional[str] = None


class MonthlyHistory(BaseModel):
    month: str
    compliant: int
    total: int


class OverviewResponse(BaseModel):
    summary: OverviewSummary
    buildings: list[BuildingComplianceRow]
    monthly_history: list[MonthlyHistory]


class TrendMonth(BaseModel):
    month: str
    compliant: int
    total: int
    compliance_rate: int


class TrendsResponse(BaseModel):
    months: list[TrendMonth]


class BuildingDrillDownResponse(BaseModel):
    building: AlarmBuildingOut
    zones: list[AlarmZoneOut]
    tests: list[AlarmTestOut]
    biannual_checks: list[AlarmBiannualCheckOut]


# ── Screen 8: Overview ───────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewResponse)
def get_overview(
    region: str | None = Query(None),
    month: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = dt_date.today()
    target_month = month or f"{today.year}-{today.month:02d}"

    q = db.query(AlarmBuilding)
    if region:
        q = q.filter(AlarmBuilding.region == region)
    buildings = q.order_by(AlarmBuilding.name).all()

    all_tests = db.query(AlarmTest).filter(AlarmTest.test_month == target_month).all()
    test_map: dict[str, list[AlarmTest]] = {}
    for t in all_tests:
        test_map.setdefault(t.building_id, []).append(t)

    rows = []
    for b in buildings:
        if b.status in ("temporarily_exempt", "closed"):
            rows.append(BuildingComplianceRow(
                building_id=b.id, building_name=b.name, region=b.region, status="exempt"))
            continue

        tests = test_map.get(b.id, [])
        approved = next((t for t in tests if t.status == "APPROVED"), None)
        submitted = next((t for t in tests if t.status == "SUBMITTED"), None)
        latest = approved or submitted or (tests[0] if tests else None)

        if approved:
            status = "compliant"
        elif submitted:
            status = "pending"
        else:
            status = "overdue"

        rows.append(BuildingComplianceRow(
            building_id=b.id, building_name=b.name, region=b.region, status=status,
            last_test_date=latest.test_date if latest else None,
            last_test_status=latest.status if latest else None,
        ))

    compliant = sum(1 for r in rows if r.status == "compliant")
    pending = sum(1 for r in rows if r.status == "pending")
    overdue = sum(1 for r in rows if r.status == "overdue")
    exempt = sum(1 for r in rows if r.status == "exempt")
    active_total = sum(1 for b in buildings if b.status == "active")

    # 12-month history
    history = []
    for i in range(11, -1, -1):
        d = dt_date.today()
        m_val = d.month - i
        y = d.year + (m_val - 1) // 12
        m_val = (m_val - 1) % 12 + 1
        m_str = f"{y}-{m_val:02d}"

        active_blds = [b for b in buildings if b.status == "active"]
        month_tests = db.query(AlarmTest).filter(
            AlarmTest.test_month == m_str, AlarmTest.status == "APPROVED"
        ).all()
        approved_bids = {t.building_id for t in month_tests}
        compliant_count = sum(1 for b in active_blds if b.id in approved_bids)
        history.append(MonthlyHistory(month=m_str, compliant=compliant_count, total=len(active_blds)))

    return OverviewResponse(
        summary=OverviewSummary(
            total_buildings=len(buildings), compliant=compliant,
            pending_review=pending, overdue=overdue, exempt=exempt,
            compliance_rate=round(compliant / active_total * 100) if active_total > 0 else 0,
        ),
        buildings=rows,
        monthly_history=history,
    )


# ── Screen 9: Trends ────────────────────────────────────────────────────────

@router.get("/trends", response_model=TrendsResponse)
def get_trends(
    months: int = Query(12, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active_buildings = db.query(AlarmBuilding).filter(AlarmBuilding.status == "active").all()
    total = len(active_buildings)

    result = []
    for i in range(months - 1, -1, -1):
        d = dt_date.today()
        m_val = d.month - i
        y = d.year + (m_val - 1) // 12
        m_val = (m_val - 1) % 12 + 1
        m_str = f"{y}-{m_val:02d}"

        month_tests = db.query(AlarmTest).filter(
            AlarmTest.test_month == m_str, AlarmTest.status == "APPROVED"
        ).all()
        approved_bids = {t.building_id for t in month_tests}
        compliant = sum(1 for b in active_buildings if b.id in approved_bids)

        result.append(TrendMonth(
            month=m_str, compliant=compliant, total=total,
            compliance_rate=round(compliant / total * 100) if total > 0 else 0,
        ))

    return TrendsResponse(months=result)


# ── Screen 10: Building Drill-Down ───────────────────────────────────────────

@router.get("/building/{building_id}", response_model=BuildingDrillDownResponse)
def get_building_drilldown(
    building_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.get(AlarmBuilding, building_id)
    if not b:
        raise HTTPException(404, "Building not found")

    zones = db.query(AlarmZone).filter(AlarmZone.building_id == building_id).order_by(AlarmZone.zone_number).all()
    tests = db.query(AlarmTest).filter(AlarmTest.building_id == building_id).order_by(AlarmTest.test_date.desc()).all()
    biannual = db.query(AlarmBiannualCheck).filter(AlarmBiannualCheck.building_id == building_id).order_by(AlarmBiannualCheck.check_date.desc()).all()

    return BuildingDrillDownResponse(building=b, zones=zones, tests=tests, biannual_checks=biannual)
