"""
/v1/admin/* — admin-specific endpoints used by the frontend admin pages.
Covers: locations (full CRUD), users (paginated), config, access grants, roster import.
"""
import math
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password, hash_password_fast
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.config import SystemConfig, LocationToleranceOverride
from app.models.access_grant import AccessGrant
from app.models.audit import AuditEvent
from app.schemas.config import GlobalConfigOut, LocationOverrideOut
from app.services.email import send_email_background, send_welcome_background
from app.services.audit import log_event

router = APIRouter(prefix="/admin", tags=["Admin"])

_ADMIN = [Depends(require_roles(UserRole.ADMIN))]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config(db: Session) -> SystemConfig:
    cfg = db.get(SystemConfig, 1)
    if not cfg:
        cfg = SystemConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _loc_out(loc: Location, cfg: SystemConfig, overrides: dict) -> dict:
    tol_override = overrides.get(loc.id)
    return {
        "id": loc.id,
        "name": loc.name,
        "cost_center": loc.cost_center,
        "city": loc.city,
        "address": loc.address,
        "expected_cash": loc.expected_cash,
        "tolerance_pct": tol_override.tolerance_pct if tol_override else cfg.default_tolerance_pct,
        "effective_tolerance_pct": tol_override.tolerance_pct if tol_override else cfg.default_tolerance_pct,
        "sla_hours": loc.sla_hours,
        "active": loc.active,
        "has_override": tol_override is not None,
        "created_at": loc.created_at.isoformat(),
        "updated_at": loc.updated_at.isoformat(),
    }


def _user_out(u: User, loc_map: dict) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role.value,
        "location_ids": u.location_ids or [],
        "location_names": [loc_map.get(lid, lid) for lid in (u.location_ids or [])],
        "active": u.active,
        "created_at": u.created_at.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# LOCATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class CreateLocationBody(BaseModel):
    name: str
    city: str = ""
    address: str = ""
    expected_cash: float = 0.0
    tolerance_pct: Optional[float] = None
    sla_hours: int = 24
    id: Optional[str] = None


class UpdateLocationBody(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    expected_cash: Optional[float] = None
    tolerance_pct: Optional[float] = None
    sla_hours: Optional[int] = None
    active: Optional[bool] = None


@router.get("/locations", dependencies=_ADMIN)
def admin_list_locations(
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Location)
    if active is not None:
        q = q.filter(Location.active == active)
    total = q.count()
    locs = q.order_by(Location.name).offset((page - 1) * page_size).limit(page_size).all()

    cfg = _get_config(db)
    overrides = {o.location_id: o for o in db.query(LocationToleranceOverride).all()}
    return {
        "items": [_loc_out(l, cfg, overrides) for l in locs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.post("/locations", dependencies=_ADMIN, status_code=201)
def admin_create_location(
    body: CreateLocationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Duplicate name check
    if db.query(Location).filter(Location.name == body.name.strip()).first():
        raise HTTPException(409, f"A location named '{body.name}' already exists")
    # Duplicate id/cost-center check
    if body.id and db.get(Location, body.id.strip()):
        raise HTTPException(409, f"Cost center '{body.id}' is already in use")

    loc = Location(
        name=body.name, city=body.city, address=body.address,
        expected_cash=body.expected_cash, sla_hours=body.sla_hours,
        **({"id": body.id.strip()} if body.id and body.id.strip() else {}),
    )
    db.add(loc)
    if body.tolerance_pct is not None:
        db.flush()
        db.add(LocationToleranceOverride(location_id=loc.id, tolerance_pct=body.tolerance_pct))
    log_event(db, current_user, "LOCATION_CREATED", f"Location {body.name} created",
              entity_id=loc.id, entity_type="Location")
    db.commit()
    db.refresh(loc)
    cfg = _get_config(db)
    overrides = {o.location_id: o for o in db.query(LocationToleranceOverride).all()}
    return _loc_out(loc, cfg, overrides)


@router.put("/locations/{location_id}", dependencies=_ADMIN)
def admin_update_location(
    location_id: str,
    body: UpdateLocationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")

    updates = body.model_dump(exclude_unset=True)
    tol = updates.pop("tolerance_pct", None)
    for k, v in updates.items():
        setattr(loc, k, v)

    if tol is not None:
        override = db.get(LocationToleranceOverride, location_id)
        if override:
            override.tolerance_pct = tol
        else:
            db.add(LocationToleranceOverride(location_id=location_id, tolerance_pct=tol))

    log_event(db, current_user, "LOCATION_UPDATED", f"Location {loc.name} updated",
              entity_id=loc.id, entity_type="Location")
    db.commit()
    db.refresh(loc)
    cfg = _get_config(db)
    overrides = {o.location_id: o for o in db.query(LocationToleranceOverride).all()}
    return _loc_out(loc, cfg, overrides)


@router.delete("/locations/{location_id}", dependencies=_ADMIN)
def admin_deactivate_location(
    location_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    loc.active = False
    log_event(db, current_user, "LOCATION_DEACTIVATED", f"Location {loc.name} deactivated",
              entity_id=loc.id, entity_type="Location")
    db.commit()
    return {"id": location_id, "active": False}


@router.post("/locations/{location_id}/reactivate", dependencies=_ADMIN)
def admin_reactivate_location(
    location_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    loc.active = True
    log_event(db, current_user, "LOCATION_REACTIVATED", f"Location {loc.name} reactivated",
              entity_id=loc.id, entity_type="Location")
    db.commit()
    return {"id": location_id, "active": True}


# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════

class AdminCreateUserBody(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole
    location_ids: list[str] = []


class AdminUpdateUserBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    location_ids: Optional[list[str]] = None


@router.get("/users", dependencies=_ADMIN)
def admin_list_users(
    role: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    location_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if active is not None:
        q = q.filter(User.active == active)
    if location_id:
        # SQLite JSON_CONTAINS not available; do in-memory filter
        all_users = q.all()
        users = [u for u in all_users if location_id in (u.location_ids or [])]
        total = len(users)
        paginated = users[(page - 1) * page_size: page * page_size]
    else:
        total = q.count()
        paginated = q.order_by(User.name).offset((page - 1) * page_size).limit(page_size).all()

    loc_map = {l.id: l.name for l in db.query(Location).all()}
    return {
        "items": [_user_out(u, loc_map) for u in paginated],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.post("/users", dependencies=_ADMIN, status_code=201)
def admin_create_user(
    body: AdminCreateUserBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(409, "Email already registered")

    # Check for a user with identical name + role + location set (all four fields match)
    name_norm = body.name.strip().lower()
    loc_set = set(body.location_ids)
    duplicate = next(
        (u for u in db.query(User).filter(User.role == body.role).all()
         if u.name.strip().lower() == name_norm and set(u.location_ids or []) == loc_set),
        None,
    )
    if duplicate:
        raise HTTPException(409, "A user with the same name, role, and location(s) already exists")

    user = User(
        name=body.name, email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        role=body.role, location_ids=body.location_ids, active=True,
    )
    db.add(user)
    log_event(db, current_user, "USER_CREATED",
              f"User {user.email} created with role {user.role.value}",
              entity_id=user.id, entity_type="User")
    db.commit()
    db.refresh(user)

    send_email_background(background, to=[user.email],
        subject="Welcome to CashRoom Compass", template="welcome.html",
        ctx={"name": user.name, "email": user.email, "temp_password": body.password})

    loc_map = {l.id: l.name for l in db.query(Location).all()}
    return _user_out(user, loc_map)


@router.put("/users/{user_id}", dependencies=_ADMIN)
def admin_update_user(
    user_id: str,
    body: AdminUpdateUserBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    updates = body.model_dump(exclude_unset=True)
    if "password" in updates:
        if updates["password"]:
            user.hashed_password = hash_password(updates.pop("password"))
        else:
            updates.pop("password")
    if "email" in updates:
        updates["email"] = updates["email"].lower().strip()
    for k, v in updates.items():
        setattr(user, k, v)

    log_event(db, current_user, "USER_UPDATED", f"User {user.email} updated",
              entity_id=user.id, entity_type="User")
    db.commit()
    db.refresh(user)
    loc_map = {l.id: l.name for l in db.query(Location).all()}
    return _user_out(user, loc_map)


@router.post("/purge-users", dependencies=_ADMIN)
def admin_purge_non_admin_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all users except admins. Used to reset the DB for retesting."""
    users_to_delete = db.query(User).filter(User.role != UserRole.ADMIN).all()
    count = len(users_to_delete)
    for u in users_to_delete:
        db.delete(u)
    log_event(db, current_user, "USERS_PURGED",
              f"All non-admin users removed ({count} deleted)",
              entity_type="User")
    db.commit()
    return {"deleted": count}


@router.post("/reset-all", dependencies=_ADMIN)
def admin_reset_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all users except the currently logged-in admin, and all locations."""
    users_deleted = db.query(User).filter(User.id != current_user.id).all()
    users_count = len(users_deleted)
    for u in users_deleted:
        db.delete(u)

    locs_deleted = db.query(Location).all()
    locs_count = len(locs_deleted)
    for l in locs_deleted:
        db.delete(l)

    db.query(AuditEvent).delete()

    db.commit()
    return {"users_deleted": users_count, "locations_deleted": locs_count}


@router.delete("/users/{user_id}", dependencies=_ADMIN)
def admin_deactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == current_user.id:
        raise HTTPException(400, "Cannot deactivate your own account")
    user.active = False
    log_event(db, current_user, "USER_DEACTIVATED", f"User {user.email} deactivated",
              entity_id=user.id, entity_type="User")
    db.commit()
    return {"id": user_id, "active": False}


@router.post("/users/{user_id}/reactivate", dependencies=_ADMIN)
def admin_reactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.active = True
    log_event(db, current_user, "USER_REACTIVATED", f"User {user.email} reactivated",
              entity_id=user.id, entity_type="User")
    db.commit()
    return {"id": user_id, "active": True}


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

class UpdateConfigBody(BaseModel):
    default_tolerance_pct: Optional[float] = None
    approval_sla_hours: Optional[int] = None
    dow_lookback_weeks: Optional[int] = None
    daily_reminder_time: Optional[str] = None
    data_retention_years: Optional[int] = None


@router.get("/config", dependencies=_ADMIN)
def admin_get_config(db: Session = Depends(get_db)):
    cfg = _get_config(db)
    overrides = db.query(LocationToleranceOverride).all()
    return {
        "global": GlobalConfigOut.model_validate(cfg).model_dump(),
        "location_overrides": [
            LocationOverrideOut(location_id=o.location_id, tolerance_pct=o.tolerance_pct,
                                updated_at=o.updated_at.isoformat()).model_dump()
            for o in overrides
        ],
    }


@router.put("/config", dependencies=_ADMIN)
def admin_update_config(
    body: UpdateConfigBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = _get_config(db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    log_event(db, current_user, "CONFIG_UPDATED", "Global config updated", entity_type="Config")
    db.commit()
    db.refresh(cfg)
    overrides = db.query(LocationToleranceOverride).all()
    return {
        "global": GlobalConfigOut.model_validate(cfg).model_dump(),
        "location_overrides": [
            LocationOverrideOut(location_id=o.location_id, tolerance_pct=o.tolerance_pct,
                                updated_at=o.updated_at.isoformat()).model_dump()
            for o in overrides
        ],
    }


@router.put("/config/locations/{location_id}", dependencies=_ADMIN)
def admin_set_override(
    location_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tol = body.get("tolerance_pct")
    if tol is None:
        raise HTTPException(400, "tolerance_pct required")
    override = db.get(LocationToleranceOverride, location_id)
    old_tol = str(override.tolerance_pct) if override else None
    if override:
        override.tolerance_pct = tol
    else:
        override = LocationToleranceOverride(location_id=location_id, tolerance_pct=tol)
        db.add(override)
    log_event(db, current_user, "CONFIG_LOCATION_OVERRIDE",
              f"Tolerance override set to {tol}% for location {location_id}",
              location_id=location_id, entity_id=location_id, entity_type="Location",
              old_value=f"{old_tol}%" if old_tol else None, new_value=f"{tol}%")
    db.commit()
    db.refresh(override)
    return LocationOverrideOut(location_id=override.location_id,
                               tolerance_pct=override.tolerance_pct,
                               updated_at=override.updated_at.isoformat()).model_dump()


@router.delete("/config/locations/{location_id}", dependencies=_ADMIN, status_code=204)
def admin_remove_override(
    location_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = db.get(LocationToleranceOverride, location_id)
    if override:
        log_event(db, current_user, "CONFIG_LOCATION_OVERRIDE_REMOVED",
                  f"Tolerance override removed for location {location_id} (was {override.tolerance_pct}%)",
                  location_id=location_id, entity_id=location_id, entity_type="Location",
                  old_value=f"{override.tolerance_pct}%")
        db.delete(override)
        db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ACCESS GRANTS
# ═══════════════════════════════════════════════════════════════════════════════

class GrantAccessBody(BaseModel):
    user_id: str
    access_type: str  # 'operator' | 'controller'
    note: str = ""


class UpdateGrantBody(BaseModel):
    note: str


def _grant_out(g: AccessGrant) -> dict:
    return {
        "id": g.id,
        "user_id": g.user_id,
        "user_name": g.user_name,
        "user_email": g.user_email,
        "user_role": g.user_role,
        "access_type": g.access_type,
        "note": g.note,
        "granted_by": g.granted_by,
        "granted_by_name": g.granted_by_name,
        "granted_at": g.granted_at.isoformat(),
    }


@router.get("/access-grants", dependencies=_ADMIN)
def list_access_grants(db: Session = Depends(get_db)):
    grants = db.query(AccessGrant).order_by(AccessGrant.granted_at.desc()).all()
    return {"items": [_grant_out(g) for g in grants]}


@router.post("/access-grants", dependencies=_ADMIN, status_code=201)
def grant_access(
    body: GrantAccessBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, body.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    grant = AccessGrant(
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        user_role=user.role.value,
        access_type=body.access_type,
        note=body.note,
        granted_by=current_user.id,
        granted_by_name=current_user.name,
    )
    db.add(grant)
    log_event(db, current_user, "ACCESS_GRANT_CREATED",
              f"{user.name} granted {body.access_type} access",
              entity_id=grant.id, entity_type="AccessGrant")
    db.commit()
    db.refresh(grant)
    return _grant_out(grant)


@router.put("/access-grants/{grant_id}", dependencies=_ADMIN)
def update_grant(
    grant_id: str,
    body: UpdateGrantBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grant = db.get(AccessGrant, grant_id)
    if not grant:
        raise HTTPException(404, "Grant not found")
    old_note = grant.note
    grant.note = body.note
    log_event(db, current_user, "ACCESS_GRANT_UPDATED",
              f"Access grant note updated for {grant.user_name}",
              entity_id=grant_id, entity_type="AccessGrant",
              old_value=old_note or None, new_value=body.note or None)
    db.commit()
    db.refresh(grant)
    return _grant_out(grant)


@router.delete("/access-grants/{grant_id}", dependencies=_ADMIN, status_code=204)
def revoke_access(
    grant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grant = db.get(AccessGrant, grant_id)
    if not grant:
        raise HTTPException(404, "Grant not found")
    log_event(db, current_user, "ACCESS_GRANT_REVOKED",
              f"Access grant {grant_id} revoked for {grant.user_name}",
              entity_id=grant_id, entity_type="AccessGrant")
    db.delete(grant)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ROSTER IMPORT
# ═══════════════════════════════════════════════════════════════════════════════

class ImportRow(BaseModel):
    location_code: str
    location_name: str
    district: Optional[str] = None
    cashroom_lead: Optional[str] = None
    cashroom_lead_email: Optional[str] = None
    daily_reviewer: Optional[str] = None
    controller: Optional[str] = None
    controller_email: Optional[str] = None
    dgm: Optional[str] = None
    dgm_email: Optional[str] = None
    regional_controller: Optional[str] = None
    regional_controller_email: Optional[str] = None
    division_contacts: Optional[str] = None
    division_contacts_email: Optional[str] = None


class ImportBody(BaseModel):
    rows: list[ImportRow]


def _generate_password(name: str) -> str:
    """Generate a name-based temporary password: FirstNameL@YYYY (min 8 chars)."""
    from datetime import datetime
    parts = name.strip().split()
    first = parts[0].capitalize() if parts else "User"
    last_initial = parts[-1][0].upper() if len(parts) > 1 else ""
    pwd = f"{first}{last_initial}@{datetime.now().year}"
    while len(pwd) < 8:
        pwd += "1"
    return pwd


@router.post("/import", dependencies=_ADMIN)
def import_roster(
    body: ImportBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import re as _re
    locs_created = locs_updated = users_created = users_updated = assignments = 0
    skipped = 0
    warnings: list[str] = []
    pending_users: dict[str, User] = {}  # email → User, deduplicates across rows in same import
    seen_keys: set[tuple] = set()         # (email, role, loc_id) — deduplicates within the Excel

    def name_to_email(val: str) -> str:
        """Convert 'Jane Smith' → 'jane.smith@compass.com'."""
        slug = _re.sub(r'[^a-z0-9]+', '.', val.lower().strip()).strip('.')
        return f"{slug}@compass.com"

    for row in body.rows:
        # Build unique location ID from district name slug; store CC# separately
        name_slug = _re.sub(r'[^a-z0-9]+', '-', row.location_name.lower()).strip('-')
        loc_id = f"loc-{name_slug}"
        cc = row.location_code.strip() if row.location_code else None
        
        # 1. Update/create Location
        loc = db.query(Location).filter(Location.id == loc_id).first()
        if loc:
            loc.name = row.location_name
            if cc: loc.cost_center = cc
            loc.expected_cash = 9575.0
            locs_updated += 1
        else:
            loc = Location(id=loc_id, name=row.location_name, cost_center=cc, city=row.district or "", address="", expected_cash=9575.0)
            db.add(loc)
            locs_created += 1
            
        db.flush() 
        
        # 2. Safely apply Tolerance Override using merge to prevent duplicate session conflicts
        override = LocationToleranceOverride(location_id=loc_id, tolerance_pct=0.5)
        db.merge(override)
        db.flush()

        # Map role column → (name, explicit_email) + UserRole
        role_map = [
            (row.cashroom_lead,       row.cashroom_lead_email,       UserRole.OPERATOR),
            (row.daily_reviewer,      None,                          UserRole.OPERATOR),
            (row.controller,          row.controller_email,          UserRole.CONTROLLER),
            (row.dgm,                 row.dgm_email,                 UserRole.DGM),
            (row.regional_controller, row.regional_controller_email, UserRole.REGIONAL_CONTROLLER),
            (row.division_contacts,   row.division_contacts_email,   UserRole.REGIONAL_CONTROLLER),
        ]
        for name_val, email_val, role in role_map:
            if not name_val:
                continue
            val = name_val.strip()
            # Prefer explicit email from import; fall back to value-is-email; else generate
            if email_val and "@" in email_val:
                if not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email_val.strip()):
                    warnings.append(f"Invalid email format skipped: '{email_val}'")
                    continue
                email = email_val.strip().lower()
                display_name = val
            elif "@" in val:
                if not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', val):
                    warnings.append(f"Invalid email format skipped: '{val}'")
                    continue
                email = val.lower()
                display_name = val
            else:
                email = name_to_email(val)
                display_name = val
                warnings.append(f"No email found for '{val}' — generated '{email}'")

            # Deduplicate within the Excel: skip if (email, role, location) already seen this import
            row_key = (email, role, loc_id)
            if row_key in seen_keys:
                skipped += 1
                continue
            seen_keys.add(row_key)

            # Check session cache first (handles same person appearing in multiple rows)
            if email in pending_users:
                user = pending_users[email]
                # Fully identical to DB state — skip
                if loc_id in (user.location_ids or []) and user.role == role and user.name == display_name:
                    skipped += 1
                    continue
                if loc_id not in (user.location_ids or []):
                    user.location_ids = list(user.location_ids or []) + [loc_id]
                    assignments += 1
            else:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    # All four fields identical — truly nothing to do
                    if (user.name == display_name and user.role == role
                            and loc_id in (user.location_ids or [])):
                        skipped += 1
                        pending_users[email] = user
                        continue
                    changed = False
                    if loc_id not in (user.location_ids or []):
                        user.location_ids = list(user.location_ids or []) + [loc_id]
                        assignments += 1
                        changed = True
                    if user.name != display_name:
                        user.name = display_name
                        changed = True
                    if changed:
                        users_updated += 1
                else:
                    temp_password = _generate_password(display_name)
                    user = User(
                        email=email, name=display_name,
                        hashed_password=hash_password_fast(temp_password),
                        role=role, location_ids=[loc_id], active=True,
                    )
                    db.add(user)
                    users_created += 1
                    assignments += 1
                    send_welcome_background(background, email, display_name, temp_password)
                pending_users[email] = user

    log_event(db, current_user, "ROSTER_IMPORT",
              f"Imported {len(body.rows)} rows: {locs_created}L created, {users_created}U created, {skipped} skipped as duplicate")
    db.commit()

    return {
        "locations_created": locs_created,
        "locations_updated": locs_updated,
        "users_created": users_created,
        "users_updated": users_updated,
        "assignments_created": assignments,
        "skipped_duplicates": skipped,
        "warnings": warnings,
    }
