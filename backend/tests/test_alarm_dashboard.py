"""
TDD: Alarm Management Dashboards — Screens 8, 9, 10, 11

API Endpoints:
  GET /v1/alarm/dashboard/overview      — Screen 8: KPIs, building table, 12-month history
  GET /v1/alarm/dashboard/trends        — Screen 9: Monthly compliance trend data
  GET /v1/alarm/dashboard/building/{id} — Screen 10: Building drill-down detail
  (Screen 11: Biannual Status already covered by /v1/alarm/biannual/status)
"""
import pytest
from datetime import date


@pytest.fixture(autouse=True)
def _reset_rules(client):
    token = client.post("/v1/auth/login", json={"email": "admin@compass.com", "password": "demo1234"}).json()["access_token"]
    client.put("/v1/alarm/rules", headers={"Authorization": f"Bearer {token}"},
        json={"require_all_zones_tested": False, "require_report_upload": False})
    yield


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_building(client, token: str, name: str, status: str = "active") -> str:
    r = client.post("/v1/alarm/buildings",
        headers=_headers(token),
        json={"name": name, "region": "Midwest", "status": status})
    return r.json()["id"]


def _create_and_approve_test(client, ctrl_token: str, admin_token: str, bid: str, month: str):
    """Helper: create, submit, approve a test for a building+month."""
    today = date.today()
    r = client.post("/v1/alarm/tests",
        headers=_headers(ctrl_token),
        json={"building_id": bid, "test_date": today.isoformat(), "test_month": month})
    tid = r.json()["id"]
    client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(ctrl_token))
    client.post(f"/v1/alarm/tests/{tid}/approve",
        headers=_headers(admin_token), json={"notes": "OK"})
    return tid


# ══════════════════════════════════════════════════════════════════════════════
# Screen 8: Alarm Compliance Dashboard
# ══════════════════════════════════════════════════════════════════════════════

class TestAlarmOverview:
    """GET /v1/alarm/dashboard/overview"""

    def test_returns_summary_and_buildings(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/overview", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "summary" in body
        assert "buildings" in body
        assert "monthly_history" in body
        s = body["summary"]
        assert "total_buildings" in s
        assert "compliant" in s
        assert "pending_review" in s
        assert "overdue" in s
        assert "exempt" in s
        assert "compliance_rate" in s

    def test_building_rows_have_status(self, client, admin_token):
        _create_building(client, admin_token, "Dash Active")
        _create_building(client, admin_token, "Dash Exempt", "temporarily_exempt")

        r = client.get("/v1/alarm/dashboard/overview", headers=_headers(admin_token))
        buildings = r.json()["buildings"]
        statuses = {b["status"] for b in buildings}
        # Should have at least overdue (active no test) and exempt
        assert "overdue" in statuses or "exempt" in statuses

    def test_compliant_building_counted(self, client, admin_token, controller_token):
        bid = _create_building(client, admin_token, "Dash Compliant")
        today = date.today()
        month = f"{today.year}-{today.month:02d}"
        _create_and_approve_test(client, controller_token, admin_token, bid, month)

        r = client.get("/v1/alarm/dashboard/overview", headers=_headers(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row is not None
        assert row["status"] == "compliant"

    def test_monthly_history_has_12_months(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/overview", headers=_headers(admin_token))
        assert len(r.json()["monthly_history"]) == 12

    def test_filter_by_region(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/overview?region=Midwest", headers=_headers(admin_token))
        assert r.status_code == 200
        for b in r.json()["buildings"]:
            assert b["region"] == "Midwest"

    def test_unauthenticated_cannot_access(self, client):
        r = client.get("/v1/alarm/dashboard/overview")
        assert r.status_code in (401, 403)


# ══════════════════════════════════════════════════════════════════════════════
# Screen 9: Alarm Trends
# ══════════════════════════════════════════════════════════════════════════════

class TestAlarmTrends:
    """GET /v1/alarm/dashboard/trends"""

    def test_returns_months_array(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/trends", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "months" in body
        assert isinstance(body["months"], list)
        assert len(body["months"]) == 12  # default

    def test_each_month_has_fields(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/trends", headers=_headers(admin_token))
        for m in r.json()["months"]:
            assert "month" in m
            assert "compliant" in m
            assert "total" in m
            assert "compliance_rate" in m

    def test_custom_months_param(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/trends?months=6", headers=_headers(admin_token))
        assert r.status_code == 200
        assert len(r.json()["months"]) == 6


# ══════════════════════════════════════════════════════════════════════════════
# Screen 10: Building Drill-Down
# ══════════════════════════════════════════════════════════════════════════════

class TestBuildingDrillDown:
    """GET /v1/alarm/dashboard/building/{id}"""

    def test_returns_building_detail(self, client, admin_token):
        bid = _create_building(client, admin_token, "DrillDown Building")

        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["building"]["id"] == bid
        assert "zones" in body
        assert "tests" in body
        assert "biannual_checks" in body

    def test_includes_zones(self, client, admin_token):
        bid = _create_building(client, admin_token, "DrillDown Zones")
        # Add a zone
        client.post("/v1/alarm/zones",
            headers=_headers(admin_token),
            json={"building_id": bid, "zone_number": 1, "zone_name": "Entry", "zone_type": "ENTRY_EXIT", "area_number": 1})

        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_headers(admin_token))
        assert len(r.json()["zones"]) == 1

    def test_includes_tests(self, client, admin_token, controller_token):
        bid = _create_building(client, admin_token, "DrillDown Tests")
        today = date.today()
        month = f"{today.year}-{today.month:02d}"
        _create_and_approve_test(client, controller_token, admin_token, bid, month)

        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_headers(admin_token))
        assert len(r.json()["tests"]) >= 1

    def test_nonexistent_returns_404(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/building/nonexistent", headers=_headers(admin_token))
        assert r.status_code == 404
