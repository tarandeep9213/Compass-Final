"""
Milestone 1 — Auth tests  (TC-1.1 through TC-1.8)
"""
import pytest


# ── TC-1.1  Successful login ──────────────────────────────────────────────────
def test_login_success(client):
    r = client.post("/v1/auth/login", json={
        "email": "operator@compass.com",
        "password": "demo1234",
    })
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "operator@compass.com"
    assert body["user"]["role"] == "OPERATOR"


# ── TC-1.2  Wrong password ────────────────────────────────────────────────────
def test_login_wrong_password(client):
    r = client.post("/v1/auth/login", json={
        "email": "operator@compass.com",
        "password": "wrongpassword",
    })
    assert r.status_code == 401
    assert "detail" in r.json()


# ── TC-1.3  Non-existent user ─────────────────────────────────────────────────
def test_login_unknown_email(client):
    r = client.post("/v1/auth/login", json={
        "email": "nobody@compass.com",
        "password": "demo1234",
    })
    assert r.status_code == 401


# ── TC-1.4  GET /auth/me with valid token ─────────────────────────────────────
def test_me_valid_token(client, operator_token):
    r = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "operator@compass.com"
    assert body["role"] == "OPERATOR"
    assert "id" in body


# ── TC-1.5  GET /auth/me without token ───────────────────────────────────────
def test_me_no_token(client):
    r = client.get("/v1/auth/me")
    assert r.status_code == 403


# ── TC-1.6  GET /auth/me with garbage token ───────────────────────────────────
def test_me_bad_token(client):
    r = client.get("/v1/auth/me", headers={"Authorization": "Bearer not.a.real.token"})
    assert r.status_code == 401


# ── TC-1.7  Token refresh ─────────────────────────────────────────────────────
def test_refresh_token(client):
    # first login to get a refresh token
    login = client.post("/v1/auth/login", json={
        "email": "controller@compass.com",
        "password": "demo1234",
    })
    assert login.status_code == 200
    refresh_token = login.json()["refresh_token"]

    r = client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


# ── TC-1.8  Refresh with garbage token ───────────────────────────────────────
def test_refresh_bad_token(client):
    r = client.post("/v1/auth/refresh", json={"refresh_token": "garbage.token.here"})
    assert r.status_code == 401


# ── TC-1.9  All 6 demo roles can log in ──────────────────────────────────────
@pytest.mark.parametrize("email,expected_role", [
    ("operator@compass.com",   "OPERATOR"),
    ("controller@compass.com", "CONTROLLER"),
    ("dgm@compass.com",        "DGM"),
    ("admin@compass.com",      "ADMIN"),
    ("auditor@compass.com",    "AUDITOR"),
])
def test_all_roles_can_login(client, email, expected_role):
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    assert r.json()["user"]["role"] == expected_role


# ── TC-1.10  Health endpoint ──────────────────────────────────────────────────
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
