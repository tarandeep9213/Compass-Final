from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmZone
from app.schemas.alarm import (
    AlarmZoneOut,
    CreateAlarmZoneBody,
    UpdateAlarmZoneBody,
    ImportZonesBody,
    ImportZonesResponse,
    ResetResponse,
)

router = APIRouter(prefix="/alarm/zones", tags=["alarm-zones"])

_ADMIN = [Depends(require_roles(UserRole.ADMIN))]


@router.get("", response_model=list[AlarmZoneOut])
def list_zones(
    building_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(AlarmZone).filter(
        AlarmZone.building_id == building_id
    ).order_by(AlarmZone.zone_number).all()


@router.post("", response_model=AlarmZoneOut, status_code=201, dependencies=_ADMIN)
def create_zone(
    body: CreateAlarmZoneBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    z = AlarmZone(
        building_id=body.building_id,
        zone_number=body.zone_number,
        zone_name=body.zone_name,
        zone_type=body.zone_type,
        area_number=body.area_number,
        is_active=body.is_active,
        other_description=body.other_description,
    )
    db.add(z)
    db.commit()
    db.refresh(z)
    return z


@router.put("/{zone_id}", response_model=AlarmZoneOut, dependencies=_ADMIN)
def update_zone(
    zone_id: str,
    body: UpdateAlarmZoneBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    z = db.get(AlarmZone, zone_id)
    if not z:
        raise HTTPException(404, "Zone not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(z, field, value)

    db.commit()
    db.refresh(z)
    return z


@router.delete("/{zone_id}", dependencies=_ADMIN)
def delete_zone(
    zone_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    z = db.get(AlarmZone, zone_id)
    if not z:
        raise HTTPException(404, "Zone not found")
    db.delete(z)
    db.commit()
    return {"deleted": zone_id}


@router.post("/import", response_model=ImportZonesResponse, status_code=201, dependencies=_ADMIN)
def import_zones(
    body: ImportZonesBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created = []
    for row in body.zones:
        z = AlarmZone(
            building_id=row.building_id,
            zone_number=row.zone_number,
            zone_name=row.zone_name,
            zone_type=row.zone_type,
            area_number=row.area_number,
            is_active=row.is_active,
            other_description=row.other_description,
        )
        db.add(z)
        created.append(z)

    db.commit()
    for z in created:
        db.refresh(z)

    return ImportZonesResponse(imported=len(created), zones=created)
