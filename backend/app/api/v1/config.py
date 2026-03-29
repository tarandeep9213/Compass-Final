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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = _get_or_create_config(db)
    changes = body.model_dump(exclude_unset=True)
    old_vals = {k: str(getattr(cfg, k)) for k in changes}
    for field, value in changes.items():
        setattr(cfg, field, value)
    new_vals = {k: str(v) for k, v in changes.items()}
    from app.services.audit import log_event
    log_event(db, current_user, "CONFIG_UPDATED",
              f"Global config updated: {', '.join(f'{k}: {old_vals[k]} -> {new_vals[k]}' for k in changes)}",
              old_value=str(old_vals), new_value=str(new_vals),
              entity_type="Config")
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = db.get(LocationToleranceOverride, location_id)
    old_val = str(override.tolerance_pct) if override else "default"
    if override:
        override.tolerance_pct = body.tolerance_pct
    else:
        override = LocationToleranceOverride(
            location_id=location_id,
            tolerance_pct=body.tolerance_pct,
        )
        db.add(override)
    from app.services.audit import log_event
    log_event(db, current_user, "CONFIG_LOCATION_OVERRIDE",
              f"Tolerance override set for {location_id}: {old_val} -> {body.tolerance_pct}%",
              location_id=location_id,
              old_value=old_val, new_value=str(body.tolerance_pct),
              entity_type="Config")
    db.commit()
    db.refresh(override)
    return LocationOverrideOut(
        location_id=override.location_id,
        tolerance_pct=override.tolerance_pct,
        updated_at=override.updated_at.isoformat(),
    )


@router.delete("/locations/{location_id}/override", status_code=204,
               dependencies=[Depends(require_roles(UserRole.ADMIN))])
def remove_location_override(location_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    override = db.get(LocationToleranceOverride, location_id)
    if override:
        old_val = str(override.tolerance_pct)
        db.delete(override)
        from app.services.audit import log_event
        log_event(db, current_user, "CONFIG_LOCATION_OVERRIDE_REMOVED",
                  f"Tolerance override removed for {location_id} (was {old_val}%)",
                  location_id=location_id,
                  old_value=f"{old_val}%", new_value="default",
                  entity_type="Config")
        db.commit()
