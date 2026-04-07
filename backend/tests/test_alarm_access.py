"""
TDD: Alarm User Access — Screen 15
Manages alarm tester/approver access grants per user per building.

API Endpoints:
  GET    /v1/alarm/access              — List all access grants
  POST   /v1/alarm/access              — Grant access (admin only)
  DELETE /v1/alarm/access/{id}         — Revoke access (admin only)
  POST   /v1/alarm/access/import       — Bulk import grants (admin only)
  GET    /v1/alarm/users               — List all users eligible for alarm access
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_building(client, token: str, name: str) -> str:
    r = client.post("/v1/alarm/buildings",
        headers=_headers(token),
        json={"name": name, "region": "Midwest"},
    )
    assert r.status_code == 201
    return r.json()["id"]


# ── List Users ───────────────────────────────────────────────────────────────

class TestListAlarmUsers:
    """GET /v1/alarm/users"""

    def test_list_users(self, client, admin_token):
        r = client.get("/v1/alarm/users", headers=_headers(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert len(users) > 0
        # Each user has id, name, role
        for u in users:
            assert "id" in u
            assert "name" in u
            assert "role" in u


# ── Grant Access ─────────────────────────────────────────────────────────────

class TestGrantAccess:
    """POST /v1/alarm/access"""

    def test_admin_can_grant_tester(self, client, admin_token):
        bid = _create_building(client, admin_token, "Access Grant Test")
        # Get an operator user ID
        users = client.get("/v1/alarm/users", headers=_headers(admin_token)).json()
        op_user = next(u for u in users if u["role"] == "OPERATOR")

        r = client.post("/v1/alarm/access",
            headers=_headers(admin_token),
            json={
                "user_id": op_user["id"],
                "access_type": "tester",
                "building_ids": [bid],
                "notes": "Monthly testing duty",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["user_id"] == op_user["id"]
        assert body["user_name"] == op_user["name"]
        assert body["access_type"] == "tester"
        assert body["building_ids"] == [bid]
        assert "id" in body
        assert "granted_at" in body

    def test_admin_can_grant_approver(self, client, admin_token):
        bid = _create_building(client, admin_token, "Approver Grant Test")
        users = client.get("/v1/alarm/users", headers=_headers(admin_token)).json()
        rc_user = next(u for u in users if u["role"] == "REGIONAL_CONTROLLER")

        r = client.post("/v1/alarm/access",
            headers=_headers(admin_token),
            json={
                "user_id": rc_user["id"],
                "access_type": "approver",
                "building_ids": [bid],
            },
        )
        assert r.status_code == 201
        assert r.json()["access_type"] == "approver"

    def test_operator_cannot_grant(self, client, operator_token, admin_token):
        bid = _create_building(client, admin_token, "Op Grant Fail")
        r = client.post("/v1/alarm/access",
            headers=_headers(operator_token),
            json={"user_id": "some-id", "access_type": "tester", "building_ids": [bid]},
        )
        assert r.status_code == 403

    def test_grant_missing_fields_fails(self, client, admin_token):
        r = client.post("/v1/alarm/access",
            headers=_headers(admin_token),
            json={"access_type": "tester"},
        )
        assert r.status_code == 422


# ── List Access Grants ───────────────────────────────────────────────────────

class TestListAccess:
    """GET /v1/alarm/access"""

    def test_list_grants(self, client, admin_token):
        r = client.get("/v1/alarm/access", headers=_headers(admin_token))
        assert r.status_code == 200
        grants = r.json()
        assert isinstance(grants, list)
        # Should include the grants we created above
        assert len(grants) > 0
        for g in grants:
            assert "id" in g
            assert "user_id" in g
            assert "access_type" in g
            assert g["access_type"] in ("tester", "approver")


# ── Revoke Access ────────────────────────────────────────────────────────────

class TestRevokeAccess:
    """DELETE /v1/alarm/access/{id}"""

    def test_admin_can_revoke(self, client, admin_token):
        bid = _create_building(client, admin_token, "Revoke Test")
        users = client.get("/v1/alarm/users", headers=_headers(admin_token)).json()
        user = users[0]

        # Grant
        r = client.post("/v1/alarm/access",
            headers=_headers(admin_token),
            json={"user_id": user["id"], "access_type": "tester", "building_ids": [bid]},
        )
        grant_id = r.json()["id"]

        # Revoke
        r = client.delete(f"/v1/alarm/access/{grant_id}", headers=_headers(admin_token))
        assert r.status_code == 200

        # Verify gone from list
        r = client.get("/v1/alarm/access", headers=_headers(admin_token))
        ids = [g["id"] for g in r.json()]
        assert grant_id not in ids

    def test_revoke_nonexistent_returns_404(self, client, admin_token):
        r = client.delete("/v1/alarm/access/nonexistent", headers=_headers(admin_token))
        assert r.status_code == 404

    def test_operator_cannot_revoke(self, client, operator_token):
        r = client.delete("/v1/alarm/access/some-id", headers=_headers(operator_token))
        assert r.status_code == 403


# ── Import Access Grants ─────────────────────────────────────────────────────

class TestImportAccess:
    """POST /v1/alarm/access/import"""

    def test_bulk_import(self, client, admin_token):
        bid = _create_building(client, admin_token, "Import Access Test")
        users = client.get("/v1/alarm/users", headers=_headers(admin_token)).json()

        grants = [
            {"user_id": users[0]["id"], "access_type": "tester", "building_ids": [bid]},
            {"user_id": users[1]["id"], "access_type": "approver", "building_ids": [bid]},
        ]
        r = client.post("/v1/alarm/access/import",
            headers=_headers(admin_token),
            json={"grants": grants},
        )
        assert r.status_code == 201
        assert r.json()["imported"] == 2
