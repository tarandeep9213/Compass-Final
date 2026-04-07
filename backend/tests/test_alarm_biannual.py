"""
TDD: Biannual Checks — Screen 4
Cellular backup and camera backup verification checks.

API Endpoints:
  GET  /v1/alarm/biannual              — List checks (optional building_id filter)
  POST /v1/alarm/biannual              — Create a check
  GET  /v1/alarm/biannual/status       — All buildings' biannual status summary
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
        json={"name": name, "region": "Midwest"})
    return r.json()["id"]


# ── Create Biannual Check ────────────────────────────────────────────────────

class TestCreateBiannualCheck:
    """POST /v1/alarm/biannual"""

    def test_create_cellular_check(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Biannual Cell Test")

        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={
                "building_id": bid,
                "check_type": "CELLULAR_BACKUP",
                "check_date": "2026-04-08",
                "status": "COMPLIANT",
                "notes": "Cellular backup verified OK",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["building_id"] == bid
        assert body["check_type"] == "CELLULAR_BACKUP"
        assert body["status"] == "COMPLIANT"
        assert body["check_date"] == "2026-04-08"
        assert body["next_due_date"] is not None  # auto-calculated
        assert body["checked_by_name"] == "Chris Controller"
        assert "id" in body

    def test_create_camera_check(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Biannual Cam Test")

        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={
                "building_id": bid,
                "check_type": "CAMERA_BACKUP",
                "check_date": "2026-04-08",
                "status": "COMPLIANT",
                "days_verified": 30,
                "notes": "30-day camera backup confirmed",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["check_type"] == "CAMERA_BACKUP"
        assert body["status"] == "COMPLIANT"

    def test_create_non_compliant(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Non-compliant Test")

        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={
                "building_id": bid,
                "check_type": "CELLULAR_BACKUP",
                "check_date": "2026-04-08",
                "status": "NON_COMPLIANT",
                "notes": "Cellular backup failed — SIM card issue",
            },
        )
        assert r.status_code == 201
        assert r.json()["status"] == "NON_COMPLIANT"

    def test_unauthenticated_cannot_create(self, client):
        r = client.post("/v1/alarm/biannual", json={
            "building_id": "some-id", "check_type": "CELLULAR_BACKUP",
            "check_date": "2026-04-08", "status": "COMPLIANT",
        })
        assert r.status_code in (401, 403)

    def test_missing_fields_fails(self, client, controller_token):
        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"check_type": "CELLULAR_BACKUP"},
        )
        assert r.status_code == 422


# ── List Biannual Checks ─────────────────────────────────────────────────────

class TestListBiannualChecks:
    """GET /v1/alarm/biannual"""

    def test_list_all(self, client, controller_token):
        r = client.get("/v1/alarm/biannual", headers=_headers(controller_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_building(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Filter Biannual Test")
        client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-04-09", "status": "COMPLIANT"})

        r = client.get(f"/v1/alarm/biannual?building_id={bid}", headers=_headers(controller_token))
        assert r.status_code == 200
        for check in r.json():
            assert check["building_id"] == bid

    def test_both_types_in_list(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Both Types Test")
        client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-04-10", "status": "COMPLIANT"})
        client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CAMERA_BACKUP",
                  "check_date": "2026-04-10", "status": "COMPLIANT"})

        r = client.get(f"/v1/alarm/biannual?building_id={bid}", headers=_headers(controller_token))
        types = [c["check_type"] for c in r.json()]
        assert "CELLULAR_BACKUP" in types
        assert "CAMERA_BACKUP" in types


# ── Biannual Status Summary ──────────────────────────────────────────────────

class TestBiannualStatus:
    """GET /v1/alarm/biannual/status"""

    def test_status_returns_all_buildings(self, client, admin_token):
        # Create 2 buildings
        bid1 = _create_building(client, admin_token, "Status Bld 1")
        bid2 = _create_building(client, admin_token, "Status Bld 2")

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        bids = [row["building_id"] for row in rows]
        assert bid1 in bids
        assert bid2 in bids

    def test_status_shows_check_info(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Status Check Info")
        client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-04-08", "status": "COMPLIANT"})

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row is not None
        assert row["cellular_status"] == "COMPLIANT"
        assert row["cellular_next_due"] is not None

    def test_status_no_check_default(self, client, admin_token):
        bid = _create_building(client, admin_token, "No Check Building")

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row is not None
        assert row["cellular_status"] == "NO_CHECK"
        assert row["camera_status"] == "NO_CHECK"
