from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmBuilding
from app.api.v1.alarm_audit_helper import log_alarm_event
from app.schemas.alarm import (
    AlarmBuildingOut,
    CreateAlarmBuildingBody,
    UpdateAlarmBuildingBody,
    ImportBuildingsBody,
    ImportBuildingsResponse,
    ResetResponse,
)

router = APIRouter(prefix="/alarm/buildings", tags=["alarm-buildings"])

_ADMIN = [Depends(require_roles(UserRole.ALARM_ADMIN))]
_READER = [Depends(require_roles(
    UserRole.ALARM_TESTER, UserRole.ALARM_APPROVER, UserRole.ALARM_ADMIN,
    UserRole.CONTROLLER, UserRole.DGM, UserRole.REGIONAL_CONTROLLER,
))]


@router.get("", response_model=list[AlarmBuildingOut], dependencies=_READER)
def list_buildings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(AlarmBuilding).order_by(AlarmBuilding.name).all()


@router.get("/{building_id}", response_model=AlarmBuildingOut, dependencies=_READER)
def get_building(
    building_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.get(AlarmBuilding, building_id)
    if not b:
        raise HTTPException(404, "Building not found")
    return b


@router.post("", response_model=AlarmBuildingOut, status_code=201, dependencies=_ADMIN)
def create_building(
    body: CreateAlarmBuildingBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = AlarmBuilding(
        name=body.name,
        region=body.region,
        security_company_name=body.security_company_name,
        security_customer_id=body.security_customer_id,
        security_company_phone=body.security_company_phone,
        status=body.status,
        exempt_reason=body.exempt_reason,
        assigned_testers=body.assigned_testers,
        assigned_approver=body.assigned_approver,
    )
    db.add(b)
    log_alarm_event(db, current_user, "BUILDING_ADDED", "building", f"Added building {body.name}")
    db.commit()
    db.refresh(b)
    return b


@router.put("/{building_id}", response_model=AlarmBuildingOut, dependencies=_ADMIN)
def update_building(
    building_id: str,
    body: UpdateAlarmBuildingBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.get(AlarmBuilding, building_id)
    if not b:
        raise HTTPException(404, "Building not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(b, field, value)

    log_alarm_event(db, current_user, "BUILDING_UPDATED", "building", f"Updated building {b.name}")
    db.commit()
    db.refresh(b)
    return b


@router.post("/import", response_model=ImportBuildingsResponse, status_code=201, dependencies=_ADMIN)
def import_buildings(
    body: ImportBuildingsBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created = []
    for row in body.buildings:
        b = AlarmBuilding(
            name=row.name,
            region=row.region,
            security_company_name=row.security_company_name,
            security_customer_id=row.security_customer_id,
            security_company_phone=row.security_company_phone,
            status=row.status,
            exempt_reason=row.exempt_reason,
            assigned_testers=row.assigned_testers,
            assigned_approver=row.assigned_approver,
        )
        db.add(b)
        created.append(b)

    db.commit()
    for b in created:
        db.refresh(b)

    return ImportBuildingsResponse(imported=len(created), buildings=created)


@router.post("/reset", response_model=ResetResponse, dependencies=_ADMIN)
def reset_buildings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(AlarmBuilding).delete()
    db.commit()
    return ResetResponse(deleted=count)
