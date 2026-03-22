"""
Password Reset tests (TC-PW-1.x)

Tests for POST /auth/forgot-password and POST /auth/reset-password.
Uses the test DB (no real email delivery — email is fire-and-forget in background).
"""
import pytest
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import hash_password
from tests.conftest import TestingSessionLocal

from datetime import datetime, timedelta


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user(email: str) -> User:
    """Fetch a user directly from the test DB."""
    db: Session = TestingSessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()


def _set_reset_token(email: str, otp: str, expires_delta_minutes: int = 15):
    """Directly write a password reset token into the test DB (bypasses email)."""
    db: Session = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.password_reset_token = hash_password(otp)
        user.password_reset_expires = datetime.utcnow() + timedelta(minutes=expires_delta_minutes)
        db.commit()
    finally:
        db.close()


def _clear_reset_token(email: str):
    db: Session = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()
    finally:
        db.close()


# ── TC-PW-1.1  forgot-password always returns 200 (registered email) ─────────
def test_forgot_password_known_email(client):
    r = client.post("/v1/auth/forgot-password", json={"email": "operator@compass.com"})
    assert r.status_code == 200
    body = r.json()
    assert "message" in body
    # Message must not reveal whether the email exists
    assert "reset code" in body["message"].lower() or "sent" in body["message"].lower()


# ── TC-PW-1.2  forgot-password returns 200 for unknown email (no leak) ───────
def test_forgot_password_unknown_email(client):
    r = client.post("/v1/auth/forgot-password", json={"email": "nobody@nowhere.com"})
    # Must still return 200 — never reveal that the email isn't registered
    assert r.status_code == 200
    assert "message" in r.json()


# ── TC-PW-1.3  forgot-password stores a hashed OTP in the DB ─────────────────
def test_forgot_password_stores_token(client):
    _clear_reset_token("controller@compass.com")
    user_before = _get_user("controller@compass.com")
    assert user_before.password_reset_token is None

    client.post("/v1/auth/forgot-password", json={"email": "controller@compass.com"})

    user_after = _get_user("controller@compass.com")
    assert user_after.password_reset_token is not None
    assert user_after.password_reset_expires is not None
    assert user_after.password_reset_expires > datetime.utcnow()


# ── TC-PW-1.4  reset-password succeeds with valid OTP ────────────────────────
def test_reset_password_valid_otp(client):
    email = "dgm@compass.com"
    otp = "123456"
    _set_reset_token(email, otp)

    r = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": otp,
        "new_password": "NewPassword1",
    })
    assert r.status_code == 200
    assert "reset successfully" in r.json()["message"].lower() or "sign in" in r.json()["message"].lower()

    # OTP must be cleared after use
    user = _get_user(email)
    assert user.password_reset_token is None
    assert user.password_reset_expires is None

    # Old password (demo1234) no longer works — new password does
    login_old = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert login_old.status_code == 401

    login_new = client.post("/v1/auth/login", json={"email": email, "password": "NewPassword1"})
    assert login_new.status_code == 200

    # Restore demo password so other tests still work
    _set_reset_token(email, "999999")
    client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "999999",
        "new_password": "demo1234",
    })


# ── TC-PW-1.5  reset-password fails with wrong OTP ───────────────────────────
def test_reset_password_wrong_otp(client):
    email = "admin@compass.com"
    _set_reset_token(email, "654321")

    r = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "000000",          # wrong
        "new_password": "SomePassword1",
    })
    assert r.status_code == 400
    assert "invalid" in r.json()["detail"].lower() or "expired" in r.json()["detail"].lower()

    # Cleanup
    _clear_reset_token(email)


# ── TC-PW-1.6  reset-password fails with expired OTP ─────────────────────────
def test_reset_password_expired_otp(client):
    email = "auditor@compass.com"
    # Set an already-expired token (expired 1 minute ago)
    _set_reset_token(email, "111111", expires_delta_minutes=-1)

    r = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "111111",
        "new_password": "SomePassword1",
    })
    assert r.status_code == 400

    # Cleanup
    _clear_reset_token(email)


# ── TC-PW-1.7  reset-password fails when no token was ever requested ──────────
def test_reset_password_no_token_set(client):
    email = "operator@compass.com"
    _clear_reset_token(email)

    r = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "123456",
        "new_password": "SomePassword1",
    })
    assert r.status_code == 400


# ── TC-PW-1.8  reset-password fails with short new password ──────────────────
def test_reset_password_too_short(client):
    email = "operator@compass.com"
    _set_reset_token(email, "777777")

    r = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "777777",
        "new_password": "short",   # < 8 chars
    })
    assert r.status_code == 400
    assert "8 characters" in r.json()["detail"].lower() or "password" in r.json()["detail"].lower()

    # Cleanup (token still present since reset failed)
    _clear_reset_token(email)


# ── TC-PW-1.9  OTP is single-use — second reset attempt fails ────────────────
def test_reset_password_otp_single_use(client):
    email = "operator@compass.com"
    otp = "888888"
    _set_reset_token(email, otp)

    # First use — succeeds
    r1 = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": otp,
        "new_password": "FirstNewPass",
    })
    assert r1.status_code == 200

    # Second use of same OTP — must fail (token cleared)
    r2 = client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": otp,
        "new_password": "SecondNewPass",
    })
    assert r2.status_code == 400

    # Restore demo password
    _set_reset_token(email, "restore1")
    client.post("/v1/auth/reset-password", json={
        "email": email,
        "otp": "restore1",
        "new_password": "demo1234",
    })
