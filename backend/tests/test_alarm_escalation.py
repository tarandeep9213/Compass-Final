"""
TDD: Alarm Escalation — Screen 7
Overdue buildings with tier badges and send reminder action.

API Endpoints:
  GET  /v1/alarm/escalation/overdue     — List overdue buildings with tier info
  POST /v1/alarm/escalation/remind      — Send reminder for a building
"""
import pytest


@pytest.fixture(autouse=True)
def _reset_rules(client):
    token = client.post("/v1/auth/login", json={"email": "alarmadmin@alarm.compass.com", "password": "demo1234"}).json()["access_token"]
    client.put("/v1/alarm/rules", headers={"Authorization": f"Bearer {token}"},
        json={"require_all_zones_tested": False, "require_report_upload": False})
    yield


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_building(client, token: str, name: str) -> str:
    r = client.post("/v1/alarm/buildings",
        headers=_headers(token),
        json={"name": name, "region": "Midwest", "status": "active"})
    return r.json()["id"]


# ── Overdue Buildings ────────────────────────────────────────────────────────

class TestOverdueBuildings:
    """GET /v1/alarm/escalation/overdue"""

    def test_returns_list(self, client, alarm_admin_token, alarm_approver_token):
        r = client.get("/v1/alarm/escalation/overdue", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_active_building_no_test_is_overdue(self, client, alarm_admin_token, alarm_approver_token):
        bid = _create_building(client, alarm_admin_token, "Overdue Building")

        r = client.get("/v1/alarm/escalation/overdue", headers=_headers(alarm_admin_token))
        assert r.status_code == 200
        bids = [b["building_id"] for b in r.json()]
        assert bid in bids

    def test_overdue_has_tier(self, client, alarm_admin_token, alarm_approver_token):
        _create_building(client, alarm_admin_token, "Tier Check Building")

        r = client.get("/v1/alarm/escalation/overdue", headers=_headers(alarm_admin_token))
        for row in r.json():
            assert "days_since_last_test" in row
            assert "assigned_testers" in row
            assert "building_name" in row
            assert "region" in row

    def test_approved_building_not_overdue(self, client, alarm_admin_token, alarm_approver_token, alarm_tester_token):
        bid = _create_building(client, alarm_admin_token, "Approved Not Overdue")

        # Create + submit + approve a test for current month
        from datetime import date
        today = date.today()
        month = f"{today.year}-{today.month:02d}"
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": today.isoformat(), "test_month": month})
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        client.post(f"/v1/alarm/tests/{tid}/approve",
            headers=_headers(alarm_approver_token), json={"notes": "OK"})

        r = client.get("/v1/alarm/escalation/overdue", headers=_headers(alarm_admin_token))
        bids = [b["building_id"] for b in r.json()]
        assert bid not in bids

    def test_exempt_building_not_overdue(self, client, alarm_admin_token, alarm_approver_token):
        r = client.post("/v1/alarm/buildings",
            headers=_headers(alarm_admin_token),
            json={"name": "Exempt Building", "region": "Midwest", "status": "temporarily_exempt"})
        bid = r.json()["id"]

        r = client.get("/v1/alarm/escalation/overdue", headers=_headers(alarm_admin_token))
        bids = [b["building_id"] for b in r.json()]
        assert bid not in bids

    def test_unauthenticated_cannot_access(self, client):
        r = client.get("/v1/alarm/escalation/overdue")
        assert r.status_code in (401, 403)


# ── Send Reminder ────────────────────────────────────────────────────────────

class TestSendReminder:
    """POST /v1/alarm/escalation/remind"""

    def test_send_reminder(self, client, alarm_admin_token, alarm_approver_token):
        bid = _create_building(client, alarm_admin_token, "Reminder Building")

        r = client.post("/v1/alarm/escalation/remind",
            headers=_headers(alarm_admin_token),
            json={"building_id": bid, "tier": 1},
        )
        assert r.status_code == 200
        assert r.json()["sent"] is True
        assert r.json()["building_id"] == bid

    def test_send_reminder_tier_2(self, client, alarm_admin_token, alarm_approver_token):
        bid = _create_building(client, alarm_admin_token, "Tier 2 Reminder")

        r = client.post("/v1/alarm/escalation/remind",
            headers=_headers(alarm_admin_token),
            json={"building_id": bid, "tier": 2},
        )
        assert r.status_code == 200
        assert r.json()["tier"] == 2

    def test_operator_cannot_send_reminder(self, client, operator_token, alarm_admin_token, alarm_approver_token):
        bid = _create_building(client, alarm_admin_token, "Op Remind Fail")

        r = client.post("/v1/alarm/escalation/remind",
            headers=_headers(operator_token),
            json={"building_id": bid, "tier": 1},
        )
        assert r.status_code == 403
