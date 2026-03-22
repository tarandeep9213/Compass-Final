"""
Milestone 6 — Admin endpoints, Access Grants, Roster Import (TC-6.x)
"""
import pytest


# ═══════════════════════════════════════════
# ADMIN LOCATIONS
# ═══════════════════════════════════════════

# ── TC-6.1  Admin lists all locations with full fields ───────────────────────
def test_admin_list_locations(client, admin_token):
    r = client.get("/v1/admin/locations",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 5
    loc = body["items"][0]
    assert "expected_cash" in loc
    assert "sla_hours" in loc
    assert "has_override" in loc
    assert "effective_tolerance_pct" in loc


# ── TC-6.2  Admin creates location with expected_cash ────────────────────────
def test_admin_create_location(client, admin_token):
    r = client.post("/v1/admin/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Admin Test Site", "city": "Bristol",
              "expected_cash": 5000.0, "sla_hours": 12},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["expected_cash"] == 5000.0
    assert body["sla_hours"] == 12


# ── TC-6.3  Admin updates location ───────────────────────────────────────────
def test_admin_update_location(client, admin_token):
    r = client.put("/v1/admin/locations/loc-1",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"expected_cash": 3000.0, "tolerance_pct": 4.0},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["expected_cash"] == 3000.0
    assert body["has_override"] is True
    assert body["effective_tolerance_pct"] == 4.0


# ── TC-6.4  Admin deactivates and reactivates location ───────────────────────
def test_admin_deactivate_reactivate_location(client, admin_token):
    # Create throwaway location
    create = client.post("/v1/admin/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Temp Site", "city": "Derby"},
    )
    loc_id = create.json()["id"]

    r = client.delete(f"/v1/admin/locations/{loc_id}",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["active"] is False

    r2 = client.post(f"/v1/admin/locations/{loc_id}/reactivate",
        headers={"Authorization": f"Bearer {admin_token}"}, json={})
    assert r2.status_code == 200
    assert r2.json()["active"] is True


# ═══════════════════════════════════════════
# ADMIN USERS
# ═══════════════════════════════════════════

# ── TC-6.5  Admin lists users (paginated) ────────────────────────────────────
def test_admin_list_users_paginated(client, admin_token):
    r = client.get("/v1/admin/users?page=1&page_size=3",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert len(body["items"]) <= 3
    assert body["total"] >= 6
    assert "location_names" in body["items"][0]


# ── TC-6.6  Admin filters users by role ──────────────────────────────────────
def test_admin_list_users_filter_role(client, admin_token):
    r = client.get("/v1/admin/users?role=OPERATOR",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    for u in r.json()["items"]:
        assert u["role"] == "OPERATOR"


# ── TC-6.7  Admin deactivates and reactivates user ───────────────────────────
def test_admin_deactivate_reactivate_user(client, admin_token):
    # Create throwaway user
    create = client.post("/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Temp User", "email": "temp6@compass.com",
              "password": "Temp1234!", "role": "AUDITOR"},
    )
    uid = create.json()["id"]

    r = client.delete(f"/v1/admin/users/{uid}",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["active"] is False

    r2 = client.post(f"/v1/admin/users/{uid}/reactivate",
        headers={"Authorization": f"Bearer {admin_token}"}, json={})
    assert r2.status_code == 200
    assert r2.json()["active"] is True


# ═══════════════════════════════════════════
# ADMIN CONFIG
# ═══════════════════════════════════════════

# ── TC-6.8  Admin config get/update ─────────────────────────────────────────
def test_admin_config(client, admin_token):
    r = client.get("/v1/admin/config",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert "global" in r.json()
    assert "location_overrides" in r.json()

    r2 = client.put("/v1/admin/config",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"approval_sla_hours": 36},
    )
    assert r2.status_code == 200
    assert r2.json()["global"]["approval_sla_hours"] == 36

    # Revert
    client.put("/v1/admin/config",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"approval_sla_hours": 24})


# ═══════════════════════════════════════════
# ACCESS GRANTS
# ═══════════════════════════════════════════

# ── TC-6.9  Grant and list access ────────────────────────────────────────────
def test_access_grants_crud(client, admin_token):
    # Get controller user id
    users = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    ctrl = next(u for u in users if u["email"] == "controller@compass.com")

    # Grant
    r = client.post("/v1/admin/access-grants",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": ctrl["id"], "access_type": "operator",
              "note": "Temporary coverage"},
    )
    assert r.status_code == 201
    grant = r.json()
    assert grant["access_type"] == "operator"
    grant_id = grant["id"]

    # List
    r2 = client.get("/v1/admin/access-grants",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200
    ids = [g["id"] for g in r2.json()["items"]]
    assert grant_id in ids

    # Update note
    r3 = client.put(f"/v1/admin/access-grants/{grant_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"note": "Updated note"},
    )
    assert r3.status_code == 200
    assert r3.json()["note"] == "Updated note"

    # Revoke
    r4 = client.delete(f"/v1/admin/access-grants/{grant_id}",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r4.status_code == 204


# ── TC-6.10  Non-admin cannot access grants endpoint ─────────────────────────
def test_grants_forbidden_operator(client, operator_token):
    r = client.get("/v1/admin/access-grants",
        headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 403


# ═══════════════════════════════════════════
# ROSTER IMPORT
# ═══════════════════════════════════════════

# ── TC-6.11  Import roster rows ──────────────────────────────────────────────
def test_roster_import(client, admin_token):
    r = client.post("/v1/admin/import",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"rows": [
            {
                "location_code": "TEST01",
                "location_name": "Import Test Café",
                "district": "London",
                "cashroom_lead": "cashier@compass.com",
                "controller": "ctrl2@compass.com",
            }
        ]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["locations_created"] >= 1
    assert body["users_created"] >= 2
    assert "warnings" in body


# ── TC-6.12  Import with invalid email warns rather than crashes ──────────────
def test_roster_import_invalid_email(client, admin_token):
    r = client.post("/v1/admin/import",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"rows": [
            {"location_code": "TEST02", "location_name": "Test Site 2",
             "cashroom_lead": "Not An Email"}
        ]},
    )
    assert r.status_code == 200
    assert len(r.json()["warnings"]) >= 1
