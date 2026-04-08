"""
TDD: Compliance Rules → Behavior Tests
Verifies that changing rules actually affects escalation and approval logic.

1. Escalation tier thresholds from rules → overdue tier calculation
2. require_all_zones_tested → submit validation
3. require_report_upload → submit validation
4. monthly_deadline_day → overdue determination
5. approval_sla_days → (future: SLA breach detection)
"""
import io
import pytest
from datetime import date, timedelta


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _building(client, token, name):
    r = client.post("/v1/alarm/buildings", headers=_h(token),
        json={"name": name, "region": "Midwest", "status": "active"})
    return r.json()["id"]


def _zone(client, token, bid, num, name, ztype="ENTRY_EXIT"):
    r = client.post("/v1/alarm/zones", headers=_h(token),
        json={"building_id": bid, "zone_number": num, "zone_name": name, "zone_type": ztype, "area_number": 1})
    return r.json()["id"]


def _test(client, token, bid):
    today = date.today()
    r = client.post("/v1/alarm/tests", headers=_h(token),
        json={"building_id": bid, "test_date": today.isoformat(), "test_month": f"{today.year}-{today.month:02d}"})
    return r.json()["id"]


def _set_rules(client, token, **kwargs):
    r = client.put("/v1/alarm/rules", headers=_h(token), json=kwargs)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(autouse=True)
def reset_rules_to_permissive(client):
    """Reset rules to permissive defaults before and after each test."""
    token = _auth(client, "admin@compass.com")
    _set_rules(client, token,
        require_all_zones_tested=False,
        require_report_upload=False,
        require_approver_signoff=True,
        monthly_deadline_day=28,
        approval_sla_days=5,
        escalation={
            "tier1": {"days_before": 7, "recipients": ["tester"]},
            "tier2": {"days_after": 0, "recipients": ["tester", "approver"]},
            "tier3": {"days_after": 3, "recipients": ["tester", "approver", "regional"]},
        },
    )
    yield
    _set_rules(client, token,
        require_all_zones_tested=False,
        require_report_upload=False,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1. ESCALATION TIERS: overdue endpoint returns tier based on rules thresholds
# ══════════════════════════════════════════════════════════════════════════════

class TestEscalationTiersFromRules:
    """GET /v1/alarm/escalation/overdue should return escalation_tier based on rules."""

    def test_overdue_includes_tier_field(self, client, admin_token):
        _building(client, admin_token, "TierField Check")

        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert r.status_code == 200
        for row in r.json():
            assert "escalation_tier" in row

    def test_tier_changes_with_rules(self, client, admin_token):
        """Change escalation thresholds and verify tier assignment changes."""
        bid = _building(client, admin_token, "TierRules Change")

        # Set tight thresholds: tier1=1 day before, tier2=0 days after, tier3=1 day after
        _set_rules(client, admin_token, escalation={
            "tier1": {"days_before": 1, "recipients": ["tester"]},
            "tier2": {"days_after": 0, "recipients": ["tester", "approver"]},
            "tier3": {"days_after": 1, "recipients": ["tester", "approver", "regional"]},
        })

        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        row = next((b for b in r.json() if b["building_id"] == bid), None)
        assert row is not None
        # Building has never been tested (999 days) → should be highest tier
        assert row["escalation_tier"] == 3

    def test_never_tested_is_tier_3(self, client, admin_token):
        """A building that was never tested should be tier 3 (most urgent)."""
        bid = _building(client, admin_token, "NeverTested Tier3")

        _set_rules(client, admin_token, escalation={
            "tier1": {"days_before": 7, "recipients": ["tester"]},
            "tier2": {"days_after": 5, "recipients": ["tester", "approver"]},
            "tier3": {"days_after": 30, "recipients": ["tester", "approver", "regional"]},
        })

        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        row = next((b for b in r.json() if b["building_id"] == bid), None)
        assert row is not None
        assert row["days_since_last_test"] == 999
        assert row["escalation_tier"] == 3


# ══════════════════════════════════════════════════════════════════════════════
# 2. REQUIRE_ALL_ZONES_TESTED: Submit blocked if untested zones exist
# ══════════════════════════════════════════════════════════════════════════════

class TestRequireAllZonesTested:
    """When require_all_zones_tested=True, submit should warn/block if NOT_TESTED zones exist."""

    def test_submit_blocked_with_untested_zones(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=True)

        bid = _building(client, admin_token, "ReqZones Block")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        z2 = _zone(client, admin_token, bid, 2, "Panic")
        tid = _test(client, controller_token, bid)

        # Only test zone 1, leave zone 2 NOT_TESTED
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}, z2: {"result": "NOT_TESTED", "notes": ""}}})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 400
        assert "zone" in r.json()["detail"].lower() or "untested" in r.json()["detail"].lower()

    def test_submit_ok_with_all_tested(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=True, require_report_upload=False)

        bid = _building(client, admin_token, "ReqZones OK")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        z2 = _zone(client, admin_token, bid, 2, "Panic")
        tid = _test(client, controller_token, bid)

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}, z2: {"result": "TESTED", "notes": ""}}})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200

    def test_submit_ok_with_issue_found(self, client, admin_token, controller_token):
        """ISSUE_FOUND counts as tested (zone was physically tested, just had a problem)."""
        _set_rules(client, admin_token, require_all_zones_tested=True, require_report_upload=False)

        bid = _building(client, admin_token, "ReqZones Issue")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "ISSUE_FOUND", "notes": "stuck button"}}})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200

    def test_submit_allowed_when_rule_disabled(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=False, require_report_upload=False)

        bid = _building(client, admin_token, "ReqZones Disabled")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "NOT_TESTED", "notes": ""}}})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200  # allowed because rule is disabled

    def test_submit_no_zones_saved_blocked(self, client, admin_token, controller_token):
        """No zone results saved at all → should block if zones exist for building."""
        _set_rules(client, admin_token, require_all_zones_tested=True)

        bid = _building(client, admin_token, "ReqZones NoSave")
        _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        # Don't save any zone results
        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# 3. REQUIRE_REPORT_UPLOAD: Submit blocked if no attachment
# ══════════════════════════════════════════════════════════════════════════════

class TestRequireReportUpload:
    """When require_report_upload=True, submit should block if no attachment uploaded."""

    def test_submit_blocked_no_attachment(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_report_upload=True, require_all_zones_tested=False)

        bid = _building(client, admin_token, "ReqUpload Block")
        tid = _test(client, controller_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 400
        assert "report" in r.json()["detail"].lower() or "upload" in r.json()["detail"].lower() or "attachment" in r.json()["detail"].lower()

    def test_submit_ok_with_attachment(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_report_upload=True, require_all_zones_tested=False)

        bid = _building(client, admin_token, "ReqUpload OK")
        tid = _test(client, controller_token, bid)

        # Upload attachment
        client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
            files={"file": ("report.pdf", io.BytesIO(b"pdf data"), "application/pdf")})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200

    def test_submit_allowed_when_rule_disabled(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_report_upload=False, require_all_zones_tested=False)

        bid = _building(client, admin_token, "ReqUpload Disabled")
        tid = _test(client, controller_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 4. BOTH RULES COMBINED
# ══════════════════════════════════════════════════════════════════════════════

class TestCombinedRules:
    """Both require_all_zones_tested and require_report_upload enabled."""

    def test_both_required_both_missing(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=True, require_report_upload=True)

        bid = _building(client, admin_token, "Both Missing")
        _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 400

    def test_both_required_both_satisfied(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=True, require_report_upload=True)

        bid = _building(client, admin_token, "Both Satisfied")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}}})
        client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
            files={"file": ("report.pdf", io.BytesIO(b"pdf"), "application/pdf")})

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200

    def test_zones_ok_but_no_report_blocked(self, client, admin_token, controller_token):
        _set_rules(client, admin_token, require_all_zones_tested=True, require_report_upload=True)

        bid = _building(client, admin_token, "Zones OK No Report")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}}})
        # No attachment

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 400
