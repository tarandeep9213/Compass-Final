from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmAccessGrant
from app.api.v1.alarm_audit_helper import log_alarm_event
from app.schemas.alarm import (
    AlarmAccessGrantOut,
    CreateAlarmAccessGrantBody,
    ImportAccessGrantsBody,
    ImportAccessGrantsResponse,
    AlarmUserOut,
)

router = APIRouter(prefix="/alarm", tags=["alarm-access"])

_ADMIN = [Depends(require_roles(UserRole.ALARM_ADMIN))]


@router.get("/users", response_model=list[AlarmUserOut])
def list_alarm_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active users eligible for alarm access."""
    users = db.query(User).filter(User.active == True).all()
    return [AlarmUserOut(id=u.id, name=u.name, role=u.role.value) for u in users]


@router.get("/access", response_model=list[AlarmAccessGrantOut])
def list_access_grants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(AlarmAccessGrant).order_by(AlarmAccessGrant.granted_at.desc()).all()


@router.post("/access", response_model=AlarmAccessGrantOut, status_code=201, dependencies=_ADMIN)
def grant_access(
    body: CreateAlarmAccessGrantBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Look up user name
    user = db.get(User, body.user_id)
    user_name = user.name if user else ""

    grant = AlarmAccessGrant(
        user_id=body.user_id,
        user_name=user_name,
        access_type=body.access_type,
        building_ids=body.building_ids,
        notes=body.notes,
    )
    db.add(grant)
    log_alarm_event(db, current_user, "ACCESS_GRANTED", "access", f"Granted {body.access_type} access to {user_name} for {len(body.building_ids)} building(s)")
    db.commit()
    db.refresh(grant)
    return grant


@router.delete("/access/{grant_id}", dependencies=_ADMIN)
def revoke_access(
    grant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grant = db.get(AlarmAccessGrant, grant_id)
    if not grant:
        raise HTTPException(404, "Access grant not found")
    log_alarm_event(db, current_user, "ACCESS_REVOKED", "access", f"Revoked {grant.access_type} access for {grant.user_name}")
    db.delete(grant)
    db.commit()
    return {"revoked": grant_id}


@router.post("/access/import", response_model=ImportAccessGrantsResponse, status_code=201, dependencies=_ADMIN)
def import_access_grants(
    body: ImportAccessGrantsBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created = []
    for row in body.grants:
        user = db.get(User, row.user_id)
        user_name = user.name if user else ""
        grant = AlarmAccessGrant(
            user_id=row.user_id,
            user_name=user_name,
            access_type=row.access_type,
            building_ids=row.building_ids,
            notes=row.notes,
        )
        db.add(grant)
        created.append(grant)

    db.commit()
    for g in created:
        db.refresh(g)

    return ImportAccessGrantsResponse(imported=len(created), grants=created)
