from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.location import Location
from app.schemas.location import LocationOut, CreateLocationBody, UpdateLocationBody

router = APIRouter(prefix="/locations", tags=["Locations"])


DEFAULT_TOLERANCE = 5.0

def _to_out(loc: Location) -> LocationOut:
    eff = loc.tolerance_pct_override if loc.tolerance_pct_override is not None else DEFAULT_TOLERANCE
    return LocationOut(
        id=loc.id,
        name=loc.name,
        cost_center=loc.cost_center,
        city=loc.city,
        address=loc.address,
        expected_cash=loc.expected_cash,
        tolerance_pct_override=loc.tolerance_pct_override,
        tolerance_pct=eff,
        effective_tolerance_pct=eff,
        sla_hours=loc.sla_hours,
        has_override=loc.tolerance_pct_override is not None,
        active=loc.active,
        created_at=loc.created_at.isoformat(),
        updated_at=loc.updated_at.isoformat(),
    )


@router.get("", response_model=list[LocationOut])
def list_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Location).filter(Location.active == True)
    # Non-admin roles only see their assigned locations
    if current_user.role not in (UserRole.ADMIN, UserRole.DGM, UserRole.AUDITOR, UserRole.REGIONAL_CONTROLLER):
        if not current_user.location_ids:
            return []
        q = q.filter(Location.id.in_(current_user.location_ids))
    return [_to_out(loc) for loc in q.order_by(Location.name).all()]


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(UserRole.ADMIN))])
def create_location(
    body: CreateLocationBody,
    db: Session = Depends(get_db),
):
    loc = Location(
        name=body.name,
        city=body.city,
        address=body.address,
        tolerance_pct_override=body.tolerance_pct_override,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return _to_out(loc)


@router.patch("/{location_id}", response_model=LocationOut,
              dependencies=[Depends(require_roles(UserRole.ADMIN))])
def update_location(
    location_id: str,
    body: UpdateLocationBody,
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return _to_out(loc)
