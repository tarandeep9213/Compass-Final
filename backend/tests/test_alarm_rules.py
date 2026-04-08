"""
TDD: Alarm Compliance Rules — Screen 14
Singleton config: one record, get + update.

API Endpoints:
  GET  /v1/alarm/rules    — Get current compliance rules
  PUT  /v1/alarm/rules    — Update compliance rules (admin only)
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Get Rules ────────────────────────────────────────────────────────────────

class TestGetRules:
    """GET /v1/alarm/rules"""

    def test_get_returns_structure(self, client, admin_token):
        r = client.get("/v1/alarm/rules", headers=_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        # Check fields exist with correct types
        assert isinstance(body["monthly_deadline_day"], int)
        assert isinstance(body["approval_sla_days"], int)
        assert isinstance(body["require_all_zones_tested"], bool)
        assert isinstance(body["require_report_upload"], bool)
        assert isinstance(body["require_approver_signoff"], bool)
        # Escalation tiers
        assert "escalation" in body
        assert body["escalation"]["tier1"]["days_before"] == 7
        assert body["escalation"]["tier2"]["days_after"] == 0
        assert body["escalation"]["tier3"]["days_after"] == 3
        # Biannual
        assert "biannual" in body
        assert body["biannual"]["cellular_frequency_months"] == 6
        assert body["biannual"]["camera_check_frequency_days"] == 30
        # Notifications
        assert body["notifications"]["enable_email"] is True
        assert body["notifications"]["enable_in_app"] is True

    def test_any_authenticated_user_can_read(self, client, operator_token):
        r = client.get("/v1/alarm/rules", headers=_headers(operator_token))
        assert r.status_code == 200

    def test_unauthenticated_cannot_read(self, client):
        r = client.get("/v1/alarm/rules")
        assert r.status_code in (401, 403)


# ── Update Rules ─────────────────────────────────────────────────────────────

class TestUpdateRules:
    """PUT /v1/alarm/rules"""

    def test_admin_can_update_deadline(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={"monthly_deadline_day": 25},
        )
        assert r.status_code == 200
        assert r.json()["monthly_deadline_day"] == 25

        # Verify persisted
        r = client.get("/v1/alarm/rules", headers=_headers(admin_token))
        assert r.json()["monthly_deadline_day"] == 25

    def test_admin_can_update_sla(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={"approval_sla_days": 3},
        )
        assert r.status_code == 200
        assert r.json()["approval_sla_days"] == 3

    def test_admin_can_toggle_requirements(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={
                "require_all_zones_tested": False,
                "require_report_upload": False,
            },
        )
        assert r.status_code == 200
        assert r.json()["require_all_zones_tested"] is False
        assert r.json()["require_report_upload"] is False

    def test_admin_can_update_escalation_tiers(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={
                "escalation": {
                    "tier1": {"days_before": 10, "recipients": ["tester"]},
                    "tier2": {"days_after": 2, "recipients": ["tester", "approver"]},
                    "tier3": {"days_after": 5, "recipients": ["tester", "approver", "regional"]},
                },
            },
        )
        assert r.status_code == 200
        esc = r.json()["escalation"]
        assert esc["tier1"]["days_before"] == 10
        assert esc["tier2"]["days_after"] == 2
        assert esc["tier3"]["days_after"] == 5

    def test_admin_can_update_biannual(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={
                "biannual": {
                    "cellular_frequency_months": 12,
                    "camera_check_frequency_days": 60,
                    "reminder_days_before": 14,
                    "escalation": {
                        "tier1": {"days_overdue": 5, "recipients": ["tester"]},
                        "tier2": {"days_overdue": 10, "recipients": ["tester", "approver"]},
                        "tier3": {"days_overdue": 20, "recipients": ["tester", "approver", "regional"]},
                    },
                },
            },
        )
        assert r.status_code == 200
        bi = r.json()["biannual"]
        assert bi["cellular_frequency_months"] == 12
        assert bi["camera_check_frequency_days"] == 60

    def test_admin_can_update_notifications(self, client, admin_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={
                "notifications": {"enable_email": False, "enable_in_app": True},
            },
        )
        assert r.status_code == 200
        assert r.json()["notifications"]["enable_email"] is False
        assert r.json()["notifications"]["enable_in_app"] is True

    def test_partial_update_preserves_other_fields(self, client, admin_token):
        # Reset to known state
        client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={"monthly_deadline_day": 28, "approval_sla_days": 5},
        )
        # Update only one field
        r = client.put("/v1/alarm/rules",
            headers=_headers(admin_token),
            json={"monthly_deadline_day": 15},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["monthly_deadline_day"] == 15
        assert body["approval_sla_days"] == 5  # unchanged

    def test_operator_cannot_update(self, client, operator_token):
        r = client.put("/v1/alarm/rules",
            headers=_headers(operator_token),
            json={"monthly_deadline_day": 1},
        )
        assert r.status_code == 403
