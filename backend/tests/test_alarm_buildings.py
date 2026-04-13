"""
TDD: Alarm Building Setup — Screen 13
Tests written FIRST, then backend implemented to make them pass.

API Endpoints:
  GET    /v1/alarm/buildings           — List all buildings
  POST   /v1/alarm/buildings           — Create a building
  PUT    /v1/alarm/buildings/{id}      — Update a building
  POST   /v1/alarm/buildings/import    — Bulk import from CSV data
  POST   /v1/alarm/buildings/reset     — Delete all buildings
  GET    /v1/alarm/buildings/{id}      — Get single building
"""
import pytest


# ── Helpers ──────────────────────────────────────────────────────────────────

def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


SAMPLE_BUILDING = {
    "name": "Wausau Canteen Vending",
    "region": "Midwest",
    "security_company_name": "AES — Allied Emergency Signals",
    "security_customer_id": "AES9925",
    "security_company_phone": "920-735-6132",
    "status": "active",
}


# ── List Buildings ───────────────────────────────────────────────────────────

class TestListBuildings:
    """GET /v1/alarm/buildings"""

    def test_admin_can_list(self, client, alarm_admin_token):
        r = client.get("/v1/alarm/buildings", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)

    def test_unauthenticated_cannot_list(self, client):
        r = client.get("/v1/alarm/buildings")
        assert r.status_code in (401, 403)


# ── Create Building ──────────────────────────────────────────────────────────

class TestCreateBuilding:
    """POST /v1/alarm/buildings"""

    def test_admin_can_create(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json=SAMPLE_BUILDING,
        )
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "Wausau Canteen Vending"
        assert body["region"] == "Midwest"
        assert body["security_company_name"] == "AES — Allied Emergency Signals"
        assert body["security_customer_id"] == "AES9925"
        assert body["status"] == "active"
        assert "id" in body
        assert "created_at" in body

    def test_create_returns_in_list(self, client, alarm_admin_token):
        # Create a building
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "Chicago North"},
        )
        assert r.status_code == 201
        new_id = r.json()["id"]

        # Verify it appears in list
        r = client.get("/v1/alarm/buildings", headers=_headers(alarm_admin_token))
        ids = [b["id"] for b in r.json()]
        assert new_id in ids

    def test_create_with_exempt_status(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={
                **SAMPLE_BUILDING,
                "name": "Closed Building",
                "status": "temporarily_exempt",
                "exempt_reason": "Under renovation until Q3",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "temporarily_exempt"
        assert body["exempt_reason"] == "Under renovation until Q3"

    def test_operator_cannot_create(self, client, operator_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(operator_token),
            json=SAMPLE_BUILDING,
        )
        assert r.status_code == 403

    def test_create_missing_name_fails(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={"region": "Midwest"},
        )
        assert r.status_code == 422  # Validation error


# ── Get Single Building ──────────────────────────────────────────────────────

class TestGetBuilding:
    """GET /v1/alarm/buildings/{id}"""

    def test_get_existing(self, client, alarm_admin_token):
        # Create first
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "Get Test Building"},
        )
        bid = r.json()["id"]

        # Get it
        r = client.get(f"/v1/alarm/buildings/{bid}", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert r.json()["name"] == "Get Test Building"

    def test_get_nonexistent_returns_404(self, client, alarm_admin_token):
        r = client.get("/v1/alarm/buildings/nonexistent-id", headers=_headers(alarm_admin_token))
        assert r.status_code == 404


# ── Update Building ──────────────────────────────────────────────────────────

class TestUpdateBuilding:
    """PUT /v1/alarm/buildings/{id}"""

    def test_admin_can_update(self, client, alarm_admin_token):
        # Create
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "Update Test"},
        )
        bid = r.json()["id"]

        # Update
        r = client.put(f"/v1/alarm/buildings/{bid}",
            headers=_headers(alarm_admin_token),
            json={"name": "Updated Name", "region": "Southeast"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Updated Name"
        assert body["region"] == "Southeast"
        # Unchanged fields should persist
        assert body["security_customer_id"] == "AES9925"

    def test_update_nonexistent_returns_404(self, client, alarm_admin_token):
        r = client.put("/v1/alarm/buildings/nonexistent-id",
            headers=_headers(alarm_admin_token),
            json={"name": "Nope"},
        )
        assert r.status_code == 404

    def test_update_status_to_closed(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "Close Test"},
        )
        bid = r.json()["id"]

        r = client.put(f"/v1/alarm/buildings/{bid}",
            headers=_headers(alarm_admin_token),
            json={"status": "closed"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "closed"

    def test_update_assigned_testers(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "Tester Assignment"},
        )
        bid = r.json()["id"]

        r = client.put(f"/v1/alarm/buildings/{bid}",
            headers=_headers(alarm_admin_token),
            json={"assigned_testers": ["user-1", "user-2"], "assigned_approver": "user-3"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["assigned_testers"] == ["user-1", "user-2"]
        assert body["assigned_approver"] == "user-3"


# ── Import Buildings ─────────────────────────────────────────────────────────

class TestImportBuildings:
    """POST /v1/alarm/buildings/import"""

    def test_bulk_import(self, client, alarm_admin_token):
        rows = [
            {"name": "Import Building 1", "region": "Northeast", "security_company_name": "SecureCo", "security_customer_id": "SC001"},
            {"name": "Import Building 2", "region": "Northeast", "security_company_name": "SecureCo", "security_customer_id": "SC002"},
            {"name": "Import Building 3", "region": "Southeast", "security_company_name": "GuardTech", "security_customer_id": "GT001"},
        ]
        r = client.post("/v1/alarm/buildings/import",
            headers=_headers(alarm_admin_token),
            json={"buildings": rows},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["imported"] == 3
        assert len(body["buildings"]) == 3
        assert body["buildings"][0]["name"] == "Import Building 1"

    def test_import_empty_list(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/buildings/import",
            headers=_headers(alarm_admin_token),
            json={"buildings": []},
        )
        assert r.status_code == 201
        assert r.json()["imported"] == 0


# ── Reset Buildings ──────────────────────────────────────────────────────────

class TestResetBuildings:
    """POST /v1/alarm/buildings/reset"""

    def test_reset_deletes_all(self, client, alarm_admin_token):
        # Ensure at least one building exists
        client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_BUILDING, "name": "To Be Reset"},
        )

        # Reset
        r = client.post("/v1/alarm/buildings/reset", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert "deleted" in r.json()

        # Verify empty
        r = client.get("/v1/alarm/buildings", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_operator_cannot_reset(self, client, operator_token):
        r = client.post("/v1/alarm/buildings/reset", headers=_headers(operator_token))
        assert r.status_code == 403
