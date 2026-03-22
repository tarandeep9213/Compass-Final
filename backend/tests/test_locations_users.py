"""
Milestone 2 — Locations, Users, Config tests (TC-2.x)
"""
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def auth(client, email, password="demo1234"):
    r = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


# ── TC-2.1  Admin sees all locations ─────────────────────────────────────────
def test_admin_sees_all_locations(client, admin_token):
    r = client.get("/v1/locations", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    locs = r.json()
    assert len(locs) >= 5
    ids = [l["id"] for l in locs]
    assert "loc-1" in ids


# ── TC-2.2  Operator only sees assigned locations ────────────────────────────
def test_operator_sees_only_assigned(client, operator_token):
    r = client.get("/v1/locations", headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 200
    locs = r.json()
    # operator is assigned to loc-1 only
    assert all(l["id"] == "loc-1" for l in locs)


# ── TC-2.3  Create location (admin) ──────────────────────────────────────────
def test_create_location_admin(client, admin_token):
    r = client.post("/v1/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Test Café", "city": "Manchester", "address": "1 Test St"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Test Café"
    assert body["id"] is not None


# ── TC-2.4  Create location (operator) → 403 ─────────────────────────────────
def test_create_location_forbidden(client, operator_token):
    r = client.post("/v1/locations",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"name": "Nope"},
    )
    assert r.status_code == 403


# ── TC-2.5  Update location ───────────────────────────────────────────────────
def test_update_location(client, admin_token):
    r = client.patch("/v1/locations/loc-1",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"city": "Updated City"},
    )
    assert r.status_code == 200
    assert r.json()["city"] == "Updated City"


# ── TC-2.6  List users (admin only) ──────────────────────────────────────────
def test_list_users_admin(client, admin_token):
    r = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    users = r.json()
    assert len(users) >= 6
    emails = [u["email"] for u in users]
    assert "operator@compass.com" in emails


# ── TC-2.7  List users as operator → 403 ─────────────────────────────────────
def test_list_users_forbidden(client, operator_token):
    r = client.get("/v1/users", headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 403


# ── TC-2.8  Create user ───────────────────────────────────────────────────────
def test_create_user(client, admin_token):
    r = client.post("/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "New Operator",
            "email": "newop@compass.com",
            "password": "Temp1234!",
            "role": "OPERATOR",
            "location_ids": ["loc-1"],
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "newop@compass.com"
    assert body["role"] == "OPERATOR"
    assert body["active"] is True


# ── TC-2.9  Duplicate email → 409 ────────────────────────────────────────────
def test_create_user_duplicate_email(client, admin_token):
    r = client.post("/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Dup",
            "email": "operator@compass.com",
            "password": "demo1234",
            "role": "OPERATOR",
        },
    )
    assert r.status_code == 409


# ── TC-2.10  Update user ──────────────────────────────────────────────────────
def test_update_user(client, admin_token):
    # Get operator user id first
    users = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    op = next(u for u in users if u["email"] == "operator@compass.com")

    r = client.patch(f"/v1/users/{op['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Alex Updated"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Alex Updated"

    # Revert name
    client.patch(f"/v1/users/{op['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Alex Operator"},
    )


# ── TC-2.11  Soft-delete user ─────────────────────────────────────────────────
def test_soft_delete_user(client, admin_token):
    # Create a throwaway user then delete them
    create = client.post("/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Temp User", "email": "temp@compass.com",
              "password": "Temp1234!", "role": "AUDITOR"},
    )
    assert create.status_code == 201
    uid = create.json()["id"]

    r = client.delete(f"/v1/users/{uid}",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 204

    # User should appear as inactive in list
    users = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    deleted = next((u for u in users if u["id"] == uid), None)
    assert deleted is not None
    assert deleted["active"] is False


# ── TC-2.12  Get config ───────────────────────────────────────────────────────
def test_get_config(client, admin_token):
    r = client.get("/v1/config", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "global_config" in body
    assert "location_overrides" in body
    assert body["global_config"]["default_tolerance_pct"] == 5.0


# ── TC-2.13  Update global config ────────────────────────────────────────────
def test_update_config(client, admin_token):
    r = client.put("/v1/config",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"default_tolerance_pct": 7.5, "approval_sla_hours": 48},
    )
    assert r.status_code == 200
    assert r.json()["global_config"]["default_tolerance_pct"] == 7.5

    # Revert
    client.put("/v1/config",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"default_tolerance_pct": 5.0, "approval_sla_hours": 24},
    )


# ── TC-2.14  Location tolerance override ─────────────────────────────────────
def test_location_override(client, admin_token):
    r = client.put("/v1/config/locations/loc-2/override",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"tolerance_pct": 3.0},
    )
    assert r.status_code == 200
    assert r.json()["tolerance_pct"] == 3.0

    # Config should include it
    cfg = client.get("/v1/config", headers={"Authorization": f"Bearer {admin_token}"}).json()
    overrides = {o["location_id"]: o for o in cfg["location_overrides"]}
    assert "loc-2" in overrides

    # Remove override
    client.delete("/v1/config/locations/loc-2/override",
        headers={"Authorization": f"Bearer {admin_token}"})
