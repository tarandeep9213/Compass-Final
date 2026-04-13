"""
Alarm User Management — ALARM_ADMIN can CRUD alarm-only users
(ALARM_TESTER, ALARM_APPROVER, ALARM_ADMIN).

Scoped strictly to alarm roles. Cannot create/modify cashroom users.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.models.user import User, UserRole, ALARM_ROLES
from app.api.v1.alarm_audit_helper import log_alarm_event

router = APIRouter(prefix="/alarm/admin/users", tags=["alarm-users"])

_ALARM_ADMIN = [Depends(require_roles(UserRole.ALARM_ADMIN))]


class AlarmUserCreateBody(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole  # validated at runtime to be ALARM_*


class AlarmUserUpdateBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    active: Optional[bool] = None


class AlarmUserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    created_at: str

    @classmethod
    def from_orm_user(cls, u: User) -> "AlarmUserOut":
        return cls(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role.value,
            active=u.active,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )


def _ensure_alarm_role(role: UserRole) -> None:
    if role not in ALARM_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Only alarm roles allowed here: {[r.value for r in ALARM_ROLES]}",
        )


# ── List ────────────────────────────────────────────────────────────────────
@router.get("", dependencies=_ALARM_ADMIN)
def list_alarm_users(
    role: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List only alarm users (ALARM_TESTER, ALARM_APPROVER, ALARM_ADMIN)."""
    q = db.query(User).filter(User.role.in_([r.value for r in ALARM_ROLES]))
    if role:
        # Verify the requested role is an alarm role
        try:
            r = UserRole(role)
            _ensure_alarm_role(r)
            q = q.filter(User.role == r)
        except ValueError:
            raise HTTPException(400, f"Invalid role: {role}")
    if active is not None:
        q = q.filter(User.active == active)
    total = q.count()
    items = q.order_by(User.name).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [AlarmUserOut.from_orm_user(u).model_dump() for u in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


# ── Create ──────────────────────────────────────────────────────────────────
@router.post("", dependencies=_ALARM_ADMIN, status_code=201)
def create_alarm_user(
    body: AlarmUserCreateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_alarm_role(body.role)
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered")
    user = User(
        name=body.name.strip(),
        email=email,
        hashed_password=hash_password(body.password),
        role=body.role,
        location_ids=[],
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_alarm_event(
        db, current_user, action=f"alarm.user.create:{user.email}",
        category="config", details=f"Created alarm user {user.email} with role {user.role.value}",
    )
    return AlarmUserOut.from_orm_user(user).model_dump()


# ── Update ──────────────────────────────────────────────────────────────────
@router.put("/{user_id}", dependencies=_ALARM_ADMIN)
def update_alarm_user(
    user_id: str,
    body: AlarmUserUpdateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    _ensure_alarm_role(user.role)  # only allow editing existing alarm users

    updates = body.model_dump(exclude_unset=True)
    if "role" in updates:
        new_role = UserRole(updates["role"]) if isinstance(updates["role"], str) else updates["role"]
        _ensure_alarm_role(new_role)
        user.role = new_role
    if "name" in updates:
        user.name = updates["name"].strip()
    if "email" in updates:
        new_email = updates["email"].lower().strip()
        existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if existing:
            raise HTTPException(409, "Email already registered")
        user.email = new_email
    if "password" in updates:
        user.hashed_password = hash_password(updates["password"])
    if "active" in updates:
        user.active = bool(updates["active"])

    db.commit()
    db.refresh(user)
    log_alarm_event(
        db, current_user, action=f"alarm.user.update:{user.email}",
        category="config", details=f"Updated alarm user {user.email}",
    )
    return AlarmUserOut.from_orm_user(user).model_dump()


# ── Delete (soft = deactivate) ─────────────────────────────────────────────
@router.delete("/{user_id}", dependencies=_ALARM_ADMIN)
def deactivate_alarm_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    _ensure_alarm_role(user.role)
    user.active = False
    db.commit()
    log_alarm_event(
        db, current_user, action=f"alarm.user.deactivate:{user.email}",
        category="config", details=f"Deactivated alarm user {user.email}",
    )
    return {"id": user_id, "active": False}
