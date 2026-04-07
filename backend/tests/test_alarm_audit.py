"""
TDD: Alarm Audit Trail — Screen 16
Standalone audit trail for alarm module actions.

API Endpoints:
  GET  /v1/alarm/audit           — List audit events (filters: category, search, date range)
  POST /v1/alarm/audit           — Log an audit event (internal use)
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _log_event(client, token: str, action: str, category: str, details: str) -> dict:
    r = client.post("/v1/alarm/audit",
        headers=_headers(token),
        json={"action": action, "category": category, "details": details},
    )
    assert r.status_code == 201
    return r.json()


# ── Log Events ───────────────────────────────────────────────────────────────

class TestLogAuditEvent:
    """POST /v1/alarm/audit"""

    def test_admin_can_log(self, client, admin_token):
        body = _log_event(client, admin_token, "BUILDING_ADDED", "building", "Added building Wausau Office")
        assert body["action"] == "BUILDING_ADDED"
        assert body["category"] == "building"
        assert body["details"] == "Added building Wausau Office"
        assert body["user_name"] == "Adam Admin"
        assert "id" in body
        assert "timestamp" in body

    def test_log_access_event(self, client, admin_token):
        body = _log_event(client, admin_token, "ACCESS_GRANTED", "access", "Granted Tester access to Chris Controller")
        assert body["category"] == "access"

    def test_log_testing_event(self, client, controller_token):
        body = _log_event(client, controller_token, "TEST_SUBMITTED", "testing", "Test submitted for Wausau Office (April 2026)")
        assert body["category"] == "testing"

    def test_log_config_event(self, client, admin_token):
        body = _log_event(client, admin_token, "RULES_UPDATED", "config", "Deadline day changed to 15")
        assert body["category"] == "config"


# ── List Audit Events ────────────────────────────────────────────────────────

class TestListAuditEvents:
    """GET /v1/alarm/audit"""

    def test_list_all(self, client, admin_token):
        r = client.get("/v1/alarm/audit", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "total" in body
        assert isinstance(body["items"], list)
        assert len(body["items"]) > 0

    def test_filter_by_category(self, client, admin_token):
        # Seed events of different categories
        _log_event(client, admin_token, "BUILDING_UPDATED", "building", "Filter test building")
        _log_event(client, admin_token, "ACCESS_REVOKED", "access", "Filter test access")

        r = client.get("/v1/alarm/audit?category=building", headers=_headers(admin_token))
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["category"] == "building"

    def test_filter_by_search(self, client, admin_token):
        _log_event(client, admin_token, "BUILDING_ADDED", "building", "Added UniqueSearchTerm123 building")

        r = client.get("/v1/alarm/audit?search=UniqueSearchTerm123", headers=_headers(admin_token))
        assert r.status_code == 200
        assert any("UniqueSearchTerm123" in item["details"] for item in r.json()["items"])

    def test_pagination(self, client, admin_token):
        # Seed enough events
        for i in range(20):
            _log_event(client, admin_token, "TEST_SUBMITTED", "testing", f"Pagination test event {i}")

        r = client.get("/v1/alarm/audit?page=1&page_size=5", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert len(body["items"]) <= 5
        assert body["total"] > 5

    def test_filter_by_date_range(self, client, admin_token):
        r = client.get("/v1/alarm/audit?date_from=2026-04-01&date_to=2026-04-30", headers=_headers(admin_token))
        assert r.status_code == 200

    def test_unauthenticated_cannot_list(self, client):
        r = client.get("/v1/alarm/audit")
        assert r.status_code in (401, 403)

    def test_events_sorted_newest_first(self, client, admin_token):
        r = client.get("/v1/alarm/audit", headers=_headers(admin_token))
        items = r.json()["items"]
        if len(items) >= 2:
            assert items[0]["timestamp"] >= items[1]["timestamp"]
