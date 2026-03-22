from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserOut, CreateUserBody, UpdateUserBody
from app.services.email import send_email_background
from app.services.audit import log_event

router = APIRouter(prefix="/users", tags=["Users"])


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        location_ids=user.location_ids or [],
        active=user.active,
        created_at=user.created_at.isoformat(),
    )


@router.get("", response_model=list[UserOut],
            dependencies=[Depends(require_roles(UserRole.ADMIN))])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.name).all()
    return [_to_out(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(UserRole.ADMIN))])
def create_user(
    body: CreateUserBody,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        role=body.role,
        location_ids=body.location_ids,
        active=True,
    )
    db.add(user)
    log_event(db, current_user, "USER_CREATED",
              f"User {user.email} created with role {user.role.value}",
              entity_id=user.id, entity_type="User",
              new_value=f"{user.email} / {user.role.value}")
    db.commit()
    db.refresh(user)

    # N-01: Send welcome email with credentials
    send_email_background(
        background,
        to=[user.email],
        subject="Welcome to CashRoom Compass",
        template="welcome.html",
        ctx={"name": user.name, "email": user.email, "temp_password": body.password},
    )

    return _to_out(user)


@router.patch("/{user_id}", response_model=UserOut,
              dependencies=[Depends(require_roles(UserRole.ADMIN))])
def update_user(
    user_id: str,
    body: UpdateUserBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_unset=True)
    if "password" in updates:
        if updates["password"]:
            user.hashed_password = hash_password(updates.pop("password"))
        else:
            updates.pop("password")
    if "email" in updates:
        updates["email"] = updates["email"].lower().strip()

    for field, value in updates.items():
        setattr(user, field, value)

    log_event(db, current_user, "USER_UPDATED",
              f"User {user.email} updated",
              entity_id=user.id, entity_type="User")
    db.commit()
    db.refresh(user)
    return _to_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_roles(UserRole.ADMIN))])
def delete_user(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.active = False
    log_event(db, current_user, "USER_DEACTIVATED",
              f"User {user.email} deactivated",
              entity_id=user.id, entity_type="User")
    db.commit()
