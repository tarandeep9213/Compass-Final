from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.config import SystemConfig, LocationToleranceOverride
from app.schemas.config import (
    AdminConfigOut, GlobalConfigOut, LocationOverrideOut,
    UpdateGlobalConfigBody, SetLocationOverrideBody,
)

router = APIRouter(prefix="/config", tags=["Config"])


def _get_or_create_config(db: Session) -> SystemConfig:
    cfg = db.get(SystemConfig, 1)
    if not cfg:
        cfg = SystemConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=AdminConfigOut)
def get_config(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = _get_or_create_config(db)
    overrides = db.query(LocationToleranceOverride).all()
    return AdminConfigOut(
        global_config=GlobalConfigOut.model_validate(cfg),
        location_overrides=[LocationOverrideOut(
            location_id=o.location_id,
            tolerance_pct=o.tolerance_pct,
            updated_at=o.updated_at.isoformat(),
        ) for o in overrides],
    )


@router.put("", response_model=AdminConfigOut,
            dependencies=[Depends(require_roles(UserRole.ADMIN))])
def update_config(
    body: UpdateGlobalConfigBody,
    db: Session = Depends(get_db),
):
    cfg = _get_or_create_config(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    overrides = db.query(LocationToleranceOverride).all()
    return AdminConfigOut(
        global_config=GlobalConfigOut.model_validate(cfg),
        location_overrides=[LocationOverrideOut(
            location_id=o.location_id,
            tolerance_pct=o.tolerance_pct,
            updated_at=o.updated_at.isoformat(),
        ) for o in overrides],
    )


@router.put("/locations/{location_id}/override", response_model=LocationOverrideOut,
            dependencies=[Depends(require_roles(UserRole.ADMIN))])
def set_location_override(
    location_id: str,
    body: SetLocationOverrideBody,
    db: Session = Depends(get_db),
):
    override = db.get(LocationToleranceOverride, location_id)
    if override:
        override.tolerance_pct = body.tolerance_pct
    else:
        override = LocationToleranceOverride(
            location_id=location_id,
            tolerance_pct=body.tolerance_pct,
        )
        db.add(override)
    db.commit()
    db.refresh(override)
    return LocationOverrideOut(
        location_id=override.location_id,
        tolerance_pct=override.tolerance_pct,
        updated_at=override.updated_at.isoformat(),
    )


@router.delete("/locations/{location_id}/override", status_code=204,
               dependencies=[Depends(require_roles(UserRole.ADMIN))])
def remove_location_override(location_id: str, db: Session = Depends(get_db)):
    override = db.get(LocationToleranceOverride, location_id)
    if override:
        db.delete(override)
        db.commit()
