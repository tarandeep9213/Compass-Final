import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError

from app.db.session import get_db
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    RefreshResponse,
    AuthUser,
    ForgotPasswordRequest,
    VerifyOtpRequest,
    ResetPasswordRequest,
    MessageResponse,
    ChangePasswordRequest,
)
from app.services.audit import log_event
from app.services.email import send_password_reset_background, send_password_changed_background

router = APIRouter(prefix="/auth", tags=["Auth"])

# In-memory store for raw OTPs — only populated when DEBUG=True, used by E2E tests
_debug_otp_store: dict[str, str] = {}


def _full_token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=AuthUser.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse, summary="Login with email + password")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Contact your administrator.",
        )
    # Populate access_grants from AccessGrant table
    from app.models.access_grant import AccessGrant
    grants = db.query(AccessGrant).filter(AccessGrant.user_id == user.id).all()
    user.access_grants = list({g.access_type for g in grants})
    log_event(db, user, "USER_LOGIN", f"{user.name} logged in",
              entity_id=user.id, entity_type="User")
    db.commit()
    return _full_token_response(user)


@router.get("/me", response_model=AuthUser, summary="Get current user profile")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.access_grant import AccessGrant
    grants = db.query(AccessGrant).filter(AccessGrant.user_id == current_user.id).all()
    current_user.access_grants = list({g.access_type for g in grants})
    return current_user


@router.post("/refresh", response_model=RefreshResponse, summary="Refresh access token")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise JWTError("not a refresh token")
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return RefreshResponse(
        access_token=create_access_token(user.id),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/forgot-password", response_model=MessageResponse, summary="Request password reset OTP")
def forgot_password(
    body: ForgotPasswordRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from datetime import datetime
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if user and user.active:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        # Invalidate any old token by generating a fresh one and updating the expiry
        # Overwrite the old token and reset the 15-minute expiry window
        user.password_reset_token = hash_password(otp)
        user.password_reset_expires = datetime.utcnow() + timedelta(minutes=15)
        
        # Explicitly update the debug store to prevent stale codes in local testing
        if settings.DEBUG:
            _debug_otp_store[user.email.lower().strip()] = otp
            
        db.commit()
        send_password_reset_background(background, user.email, user.name, otp)
    # Always return 200 — never reveal whether the email exists
    return MessageResponse(message="If that email is registered, a reset code has been sent.")


@router.get("/dev/last-otp", include_in_schema=False, summary="E2E test helper — DEBUG only")
def dev_last_otp(email: str, db: Session = Depends(get_db)):
    """Returns the most recently generated raw OTP for E2E testing. Only available when DEBUG=True."""
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    otp = _debug_otp_store.get(email.lower().strip())
    if not otp:
        raise HTTPException(status_code=404, detail="No pending OTP for that email")
    return {"otp": otp}


@router.post("/verify-otp", response_model=MessageResponse, summary="Verify OTP without consuming it")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    now = datetime.utcnow()
    if (
        not user or not user.active
        or not user.password_reset_token
        or not user.password_reset_expires
        or user.password_reset_expires < now
        or not verify_password(body.otp, user.password_reset_token)
    ):
        raise invalid
    return MessageResponse(message="OTP verified.")


@router.post("/reset-password", response_model=MessageResponse, summary="Reset password using OTP")
def reset_password(body: ResetPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    from datetime import datetime
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    now = datetime.utcnow()
    if (
        not user or not user.active
        or not user.password_reset_token
        or not user.password_reset_expires
        or user.password_reset_expires < now
        or not verify_password(body.otp, user.password_reset_token)
    ):
        raise invalid
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")
    user.hashed_password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    log_event(db, user, "PASSWORD_RESET", f"{user.name} reset their password", entity_id=user.id, entity_type="User")
    db.commit()
    reset_at = now.strftime("%d %b %Y %H:%M UTC")
    send_password_changed_background(background, user.email, user.name, reset_at)
    return MessageResponse(message="Password reset successfully. You can now sign in.")


@router.post("/change-password", response_model=MessageResponse, summary="Change password for logged-in user")
def change_password(
    body: ChangePasswordRequest,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")
    current_user.hashed_password = hash_password(body.new_password)
    log_event(db, current_user, "PASSWORD_CHANGED", f"{current_user.name} changed their password",
              entity_id=current_user.id, entity_type="User")
    db.commit()
    from datetime import datetime
    reset_at = datetime.utcnow().strftime("%d %b %Y %H:%M UTC")
    send_password_changed_background(background, current_user.email, current_user.name, reset_at)
    return MessageResponse(message="Password changed successfully.")
