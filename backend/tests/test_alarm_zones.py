"""
TDD: Alarm Zone Configuration — Screen 12
Tests written FIRST, then backend implemented to make them pass.

API Endpoints:
  GET    /v1/alarm/zones?building_id=X  — List zones for a building
  POST   /v1/alarm/zones               — Create a zone
  PUT    /v1/alarm/zones/{id}           — Update a zone
  DELETE /v1/alarm/zones/{id}           — Delete a zone
  POST   /v1/alarm/zones/import         — Bulk import zones
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_building(client, token: str, name: str = "Zone Test Building") -> str:
    """Helper: create a building and return its ID."""
    r = client.post("/v1/alarm/buildings",
        headers=_headers(token),
        json={"name": name, "region": "Midwest"},
    )
    assert r.status_code == 201
    return r.json()["id"]


SAMPLE_ZONE = {
    "zone_number": 3,
    "zone_name": "Main Entry Door",
    "zone_type": "ENTRY_EXIT",
    "area_number": 1,
}


# ── List Zones ───────────────────────────────────────────────────────────────

class TestListZones:
    """GET /v1/alarm/zones?building_id=X"""

    def test_list_empty(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "List Empty Zones")
        r = client.get(f"/v1/alarm/zones?building_id={bid}", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert r.json() == []

    def test_list_after_create(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "List After Create")
        client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        r = client.get(f"/v1/alarm/zones?building_id={bid}", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["zone_name"] == "Main Entry Door"

    def test_list_filters_by_building(self, client, alarm_admin_token):
        bid1 = _create_building(client, alarm_admin_token, "Building A Zones")
        bid2 = _create_building(client, alarm_admin_token, "Building B Zones")
        client.post("/v1/alarm/zones", headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid1, "zone_name": "Zone A"})
        client.post("/v1/alarm/zones", headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid2, "zone_name": "Zone B"})

        r = client.get(f"/v1/alarm/zones?building_id={bid1}", headers=_headers(alarm_admin_token))
        assert len(r.json()) == 1
        assert r.json()[0]["zone_name"] == "Zone A"


# ── Create Zone ──────────────────────────────────────────────────────────────

class TestCreateZone:
    """POST /v1/alarm/zones"""

    def test_admin_can_create(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Create Zone Test")
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["zone_number"] == 3
        assert body["zone_name"] == "Main Entry Door"
        assert body["zone_type"] == "ENTRY_EXIT"
        assert body["area_number"] == 1
        assert body["is_active"] is True
        assert "id" in body

    def test_create_all_zone_types(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "All Zone Types")
        types = ["ENTRY_EXIT", "INTERIOR_MOTION", "PANIC_SILENT", "HOLDUP", "FIRE_SMOKE", "OTHER"]
        for i, zt in enumerate(types):
            r = client.post("/v1/alarm/zones",
                headers=_headers(alarm_admin_token),
                json={"building_id": bid, "zone_number": i+1, "zone_name": f"Zone {zt}", "zone_type": zt, "area_number": 1},
            )
            assert r.status_code == 201
            assert r.json()["zone_type"] == zt

    def test_create_with_other_description(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Other Zone Type")
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={
                "building_id": bid, "zone_number": 99, "zone_name": "Custom Zone",
                "zone_type": "OTHER", "area_number": 1,
                "other_description": "Special sensor near loading dock",
            },
        )
        assert r.status_code == 201
        assert r.json()["other_description"] == "Special sensor near loading dock"

    def test_operator_cannot_create(self, client, operator_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Op Create Zone")
        r = client.post("/v1/alarm/zones",
            headers=_headers(operator_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        assert r.status_code == 403

    def test_create_missing_building_id_fails(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={"zone_number": 1, "zone_name": "Test", "zone_type": "ENTRY_EXIT", "area_number": 1},
        )
        assert r.status_code == 422


# ── Update Zone ──────────────────────────────────────────────────────────────

class TestUpdateZone:
    """PUT /v1/alarm/zones/{id}"""

    def test_update_zone_name(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Update Zone Test")
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        zid = r.json()["id"]

        r = client.put(f"/v1/alarm/zones/{zid}",
            headers=_headers(alarm_admin_token),
            json={"zone_name": "Updated Entry Door"},
        )
        assert r.status_code == 200
        assert r.json()["zone_name"] == "Updated Entry Door"
        assert r.json()["zone_number"] == 3  # unchanged

    def test_deactivate_zone(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Deactivate Zone")
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        zid = r.json()["id"]

        r = client.put(f"/v1/alarm/zones/{zid}",
            headers=_headers(alarm_admin_token),
            json={"is_active": False},
        )
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_update_nonexistent_returns_404(self, client, alarm_admin_token):
        r = client.put("/v1/alarm/zones/nonexistent",
            headers=_headers(alarm_admin_token),
            json={"zone_name": "Nope"},
        )
        assert r.status_code == 404


# ── Delete Zone ──────────────────────────────────────────────────────────────

class TestDeleteZone:
    """DELETE /v1/alarm/zones/{id}"""

    def test_delete_zone(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Delete Zone Test")
        r = client.post("/v1/alarm/zones",
            headers=_headers(alarm_admin_token),
            json={**SAMPLE_ZONE, "building_id": bid},
        )
        zid = r.json()["id"]

        r = client.delete(f"/v1/alarm/zones/{zid}", headers=_headers(alarm_admin_token))
        assert r.status_code == 200

        # Verify gone
        r = client.get(f"/v1/alarm/zones?building_id={bid}", headers=_headers(alarm_admin_token))
        assert len(r.json()) == 0

    def test_delete_nonexistent_returns_404(self, client, alarm_admin_token):
        r = client.delete("/v1/alarm/zones/nonexistent", headers=_headers(alarm_admin_token))
        assert r.status_code == 404


# ── Import Zones ─────────────────────────────────────────────────────────────

class TestImportZones:
    """POST /v1/alarm/zones/import"""

    def test_bulk_import(self, client, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token, "Import Zones Test")
        zones = [
            {"building_id": bid, "zone_number": 1, "zone_name": "Front Door", "zone_type": "ENTRY_EXIT", "area_number": 1},
            {"building_id": bid, "zone_number": 2, "zone_name": "Hallway Motion", "zone_type": "INTERIOR_MOTION", "area_number": 1},
            {"building_id": bid, "zone_number": 3, "zone_name": "Panic Button", "zone_type": "PANIC_SILENT", "area_number": 1},
        ]
        r = client.post("/v1/alarm/zones/import",
            headers=_headers(alarm_admin_token),
            json={"zones": zones},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["imported"] == 3
        assert len(body["zones"]) == 3

    def test_import_empty_list(self, client, alarm_admin_token):
        r = client.post("/v1/alarm/zones/import",
            headers=_headers(alarm_admin_token),
            json={"zones": []},
        )
        assert r.status_code == 201
        assert r.json()["imported"] == 0
