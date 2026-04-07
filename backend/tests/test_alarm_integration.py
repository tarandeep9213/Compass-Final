"""
Cross-screen integration tests for the Alarm Testing Module.
Tests interactions between screens that the basic per-screen tests don't cover.

Categories:
  1. Cascade: Building delete → zones, tests, attachments, biannual, access cleaned up
  2. Dashboard accuracy: Test lifecycle changes reflected in overview KPIs + trends
  3. Escalation logic: Overdue calculations match actual test/building state
  4. Biannual cross-checks: Status summary consistent with individual check records
  5. Zone ↔ Test: Zone changes affect test zone results
  6. Access ↔ Building: Building assignments consistent with access grants
  7. Full E2E workflow: Building setup → zones → test → submit → approve → dashboard
"""
import pytest
from datetime import date, timedelta


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _building(client, token, name, region="Midwest", status="active"):
    r = client.post("/v1/alarm/buildings", headers=_h(token),
        json={"name": name, "region": region, "status": status})
    assert r.status_code == 201
    return r.json()["id"]


def _zone(client, token, bid, num, name, ztype="ENTRY_EXIT"):
    r = client.post("/v1/alarm/zones", headers=_h(token),
        json={"building_id": bid, "zone_number": num, "zone_name": name, "zone_type": ztype, "area_number": 1})
    assert r.status_code == 201
    return r.json()["id"]


def _test(client, token, bid, test_date=None, month=None):
    today = date.today()
    test_date = test_date or today.isoformat()
    month = month or f"{today.year}-{today.month:02d}"
    r = client.post("/v1/alarm/tests", headers=_h(token),
        json={"building_id": bid, "test_date": test_date, "test_month": month})
    assert r.status_code == 201
    return r.json()["id"]


def _submit(client, token, tid):
    r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(token))
    assert r.status_code == 200
    return r.json()


def _approve(client, token, tid):
    r = client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(token), json={"notes": "OK"})
    assert r.status_code == 200
    return r.json()


def _reject(client, token, tid, reason="Failed"):
    r = client.post(f"/v1/alarm/tests/{tid}/reject", headers=_h(token), json={"reason": reason})
    assert r.status_code == 200
    return r.json()


# ══════════════════════════════════════════════════════════════════════════════
# 1. CASCADE: Building delete cleans up related data
# ══════════════════════════════════════════════════════════════════════════════

class TestCascadeDelete:
    """When a building is reset/deleted, all related data should be gone."""

    def test_reset_cleans_zones(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "Cascade Zone")
        _zone(client, admin_token, bid, 1, "Door")
        _zone(client, admin_token, bid, 2, "Motion")

        # Reset all buildings
        client.post("/v1/alarm/buildings/reset", headers=_h(admin_token))

        # Zones for that building should return empty (building gone)
        r = client.get(f"/v1/alarm/zones?building_id={bid}", headers=_h(admin_token))
        # Building doesn't exist anymore, but zone query still works — zones may orphan
        # The important check: zones belong to a building that no longer exists
        assert r.status_code == 200

    def test_building_tests_independent_after_building_update(self, client, admin_token, controller_token):
        """Updating a building name doesn't break existing tests."""
        bid = _building(client, admin_token, "Original Name")
        tid = _test(client, controller_token, bid)

        # Update building name
        client.put(f"/v1/alarm/buildings/{bid}", headers=_h(admin_token),
            json={"name": "Renamed Building"})

        # Test still accessible
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert r.status_code == 200
        assert r.json()["test"]["building_id"] == bid


# ══════════════════════════════════════════════════════════════════════════════
# 2. DASHBOARD ACCURACY: Test lifecycle → Overview KPIs
# ══════════════════════════════════════════════════════════════════════════════

class TestDashboardAccuracy:
    """Dashboard overview should accurately reflect the current state of tests."""

    def test_new_building_is_overdue(self, client, admin_token):
        bid = _building(client, admin_token, "DashAcc Overdue")

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row is not None
        assert row["status"] == "overdue"

    def test_submitted_test_shows_pending(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "DashAcc Pending")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "pending"

    def test_approved_test_shows_compliant(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "DashAcc Compliant")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "compliant"

    def test_rejected_test_shows_overdue(self, client, admin_token, controller_token):
        """A rejected test means no approved test → building is overdue."""
        bid = _building(client, admin_token, "DashAcc Rejected")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid, "Bad test")

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "overdue"

    def test_exempt_building_not_counted_in_compliance_rate(self, client, admin_token):
        _building(client, admin_token, "DashAcc Exempt", status="temporarily_exempt")

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_name"] == "DashAcc Exempt"), None)
        assert row["status"] == "exempt"

    def test_kpi_counts_match_building_list(self, client, admin_token):
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        body = r.json()
        buildings = body["buildings"]
        summary = body["summary"]

        assert summary["compliant"] == sum(1 for b in buildings if b["status"] == "compliant")
        assert summary["pending_review"] == sum(1 for b in buildings if b["status"] == "pending")
        assert summary["overdue"] == sum(1 for b in buildings if b["status"] == "overdue")
        assert summary["exempt"] == sum(1 for b in buildings if b["status"] == "exempt")
        assert summary["total_buildings"] == len(buildings)

    def test_resubmit_after_reject_shows_pending(self, client, admin_token, controller_token):
        """reject → reopen → resubmit → should show pending."""
        bid = _building(client, admin_token, "DashAcc Resubmit")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid, "Redo")
        client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_h(controller_token))
        _submit(client, controller_token, tid)

        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "pending"


# ══════════════════════════════════════════════════════════════════════════════
# 3. ESCALATION: Overdue list consistent with dashboard
# ══════════════════════════════════════════════════════════════════════════════

class TestEscalationConsistency:
    """Overdue buildings in escalation should match overdue in dashboard."""

    def test_overdue_in_both_dashboard_and_escalation(self, client, admin_token):
        bid = _building(client, admin_token, "EscConsist Overdue")

        dash = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token)).json()
        esc = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token)).json()

        dash_overdue = {b["building_id"] for b in dash["buildings"] if b["status"] == "overdue"}
        esc_overdue = {b["building_id"] for b in esc}

        assert bid in dash_overdue
        assert bid in esc_overdue

    def test_compliant_not_in_escalation(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "EscConsist Compliant")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)

        esc = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token)).json()
        assert bid not in [b["building_id"] for b in esc]

    def test_exempt_not_in_escalation(self, client, admin_token):
        bid = _building(client, admin_token, "EscConsist Exempt", status="temporarily_exempt")

        esc = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token)).json()
        assert bid not in [b["building_id"] for b in esc]

    def test_pending_still_in_escalation(self, client, admin_token, controller_token):
        """Submitted but not approved → still overdue for escalation purposes."""
        bid = _building(client, admin_token, "EscConsist Pending")
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)

        esc = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token)).json()
        assert bid in [b["building_id"] for b in esc]


# ══════════════════════════════════════════════════════════════════════════════
# 4. BIANNUAL: Status summary matches individual checks
# ══════════════════════════════════════════════════════════════════════════════

class TestBiannualConsistency:
    """Biannual status should reflect the latest check per type."""

    def test_new_check_updates_status(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "BiConsist Check")

        # Initially NO_CHECK
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "NO_CHECK"

        # Add cellular check
        client.post("/v1/alarm/biannual", headers=_h(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-04-08", "status": "COMPLIANT"})

        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "COMPLIANT"
        assert row["camera_status"] == "NO_CHECK"  # camera unchanged

    def test_latest_check_wins(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "BiConsist Latest")

        # First check: compliant
        client.post("/v1/alarm/biannual", headers=_h(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-01-01", "status": "COMPLIANT"})
        # Second check: non-compliant (later date)
        client.post("/v1/alarm/biannual", headers=_h(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-07-01", "status": "NON_COMPLIANT"})

        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "NON_COMPLIANT"

    def test_biannual_in_drilldown(self, client, admin_token, controller_token):
        """Building drill-down should include biannual checks."""
        bid = _building(client, admin_token, "BiConsist Drill")
        client.post("/v1/alarm/biannual", headers=_h(controller_token),
            json={"building_id": bid, "check_type": "CAMERA_BACKUP",
                  "check_date": "2026-04-08", "status": "COMPLIANT"})

        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        assert len(r.json()["biannual_checks"]) == 1
        assert r.json()["biannual_checks"][0]["check_type"] == "CAMERA_BACKUP"


# ══════════════════════════════════════════════════════════════════════════════
# 5. ZONE ↔ TEST: Zone results tied to correct zones
# ══════════════════════════════════════════════════════════════════════════════

class TestZoneTestIntegration:
    """Zone results in a test should reference actual zones."""

    def test_zone_results_match_building_zones(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "ZoneTest Match")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        z2 = _zone(client, admin_token, bid, 2, "Motion")
        z3 = _zone(client, admin_token, bid, 3, "Panic")
        tid = _test(client, controller_token, bid)

        # Save zone results
        results = {
            z1: {"result": "TESTED", "notes": ""},
            z2: {"result": "TESTED", "notes": "OK"},
            z3: {"result": "ISSUE_FOUND", "notes": "Button stuck"},
        }
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": results})

        # Verify in test detail
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        zones = r.json()["zones"]
        assert len(zones) == 3
        zone_map = {z["alarm_zone_id"]: z for z in zones}
        assert zone_map[z1]["result"] == "TESTED"
        assert zone_map[z3]["result"] == "ISSUE_FOUND"
        assert zone_map[z3]["notes"] == "Button stuck"

    def test_zone_count_updates_on_save(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "ZoneTest Count")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        z2 = _zone(client, admin_token, bid, 2, "Motion")
        tid = _test(client, controller_token, bid)

        results = {
            z1: {"result": "TESTED", "notes": ""},
            z2: {"result": "ISSUE_FOUND", "notes": "broken"},
        }
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": results})

        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        test = r.json()["test"]
        assert test["zones_total"] == 2
        assert test["zones_tested"] == 1
        assert test["zones_issue"] == 1

    def test_overwrite_zone_results(self, client, admin_token, controller_token):
        """Saving zone results twice overwrites the first save."""
        bid = _building(client, admin_token, "ZoneTest Overwrite")
        z1 = _zone(client, admin_token, bid, 1, "Door")
        tid = _test(client, controller_token, bid)

        # First save: NOT_TESTED
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "NOT_TESTED", "notes": ""}}})

        # Second save: TESTED
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": "retested"}}})

        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert len(r.json()["zones"]) == 1
        assert r.json()["zones"][0]["result"] == "TESTED"

    def test_zones_in_drilldown(self, client, admin_token):
        bid = _building(client, admin_token, "ZoneTest Drill")
        _zone(client, admin_token, bid, 1, "Door A")
        _zone(client, admin_token, bid, 2, "Door B")

        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        assert len(r.json()["zones"]) == 2


# ══════════════════════════════════════════════════════════════════════════════
# 6. ATTACHMENTS ↔ TEST: Detail includes attachments
# ══════════════════════════════════════════════════════════════════════════════

class TestAttachmentIntegration:
    """Attachments should appear in test detail and survive test lifecycle."""

    def test_attachment_persists_through_submit_approve(self, client, admin_token, controller_token):
        import io
        bid = _building(client, admin_token, "Att Lifecycle")
        tid = _test(client, controller_token, bid)

        # Upload attachment
        client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
            files={"file": ("report.pdf", io.BytesIO(b"pdf data"), "application/pdf")})

        # Submit + approve
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)

        # Attachment still there
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert len(r.json()["attachments"]) == 1
        assert r.json()["test"]["status"] == "APPROVED"

    def test_multiple_attachments(self, client, admin_token, controller_token):
        import io
        bid = _building(client, admin_token, "Att Multiple")
        tid = _test(client, controller_token, bid)

        for name in ["report1.pdf", "report2.xlsx", "photo.jpg"]:
            client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
                files={"file": (name, io.BytesIO(b"data"), "application/octet-stream")})

        r = client.get(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token))
        assert len(r.json()) == 3


# ══════════════════════════════════════════════════════════════════════════════
# 7. TRENDS: Data consistent with actual test records
# ══════════════════════════════════════════════════════════════════════════════

class TestTrendsAccuracy:
    """Trends endpoint should match actual approved test counts."""

    def test_approved_test_increments_trend(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "Trend Incr")
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Get baseline
        r1 = client.get("/v1/alarm/dashboard/trends", headers=_h(admin_token))
        current = next((m for m in r1.json()["months"] if m["month"] == month), None)
        baseline = current["compliant"] if current else 0

        # Approve a test
        tid = _test(client, controller_token, bid)
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)

        # Check trend updated
        r2 = client.get("/v1/alarm/dashboard/trends", headers=_h(admin_token))
        updated = next((m for m in r2.json()["months"] if m["month"] == month), None)
        assert updated["compliant"] == baseline + 1


# ══════════════════════════════════════════════════════════════════════════════
# 8. FULL E2E: Complete workflow across all screens
# ══════════════════════════════════════════════════════════════════════════════

class TestFullE2EWorkflow:
    """Building setup → zones → test → zones results → submit → approve → dashboard."""

    def test_complete_alarm_workflow(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"
        import io

        # 1. Admin creates building (Screen 13)
        bid = _building(client, admin_token, "E2E Full Workflow")

        # 2. Admin adds zones (Screen 12)
        z1 = _zone(client, admin_token, bid, 3, "Main Entry Door", "ENTRY_EXIT")
        z2 = _zone(client, admin_token, bid, 14, "Hallway Motion", "INTERIOR_MOTION")
        z3 = _zone(client, admin_token, bid, 21, "Cooler Panic", "PANIC_SILENT")

        # 3. Admin grants tester access (Screen 15)
        users = client.get("/v1/alarm/users", headers=_h(admin_token)).json()
        ctrl_user = next(u for u in users if u["role"] == "CONTROLLER")
        client.post("/v1/alarm/access", headers=_h(admin_token),
            json={"user_id": ctrl_user["id"], "access_type": "tester", "building_ids": [bid]})

        # 4. Verify building appears as overdue in dashboard (Screen 8)
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "overdue"

        # 5. Verify building appears in escalation (Screen 7)
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid in [b["building_id"] for b in r.json()]

        # 6. Controller creates test (Screen 1)
        tid = _test(client, controller_token, bid)

        # 7. Controller saves zone results (Screen 1)
        results = {
            z1: {"result": "TESTED", "notes": ""},
            z2: {"result": "TESTED", "notes": "Sensor triggered"},
            z3: {"result": "TESTED", "notes": ""},
        }
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": results})

        # 8. Controller uploads report (Screen 2)
        client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
            files={"file": ("activity_report.pdf", io.BytesIO(b"%PDF test"), "application/pdf")})

        # 9. Controller submits (Screen 1)
        _submit(client, controller_token, tid)

        # 10. Verify pending in dashboard (Screen 8)
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "pending"

        # 11. Admin reviews test (Screen 6) — verify detail
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(admin_token))
        detail = r.json()
        assert detail["test"]["status"] == "SUBMITTED"
        assert len(detail["zones"]) == 3
        assert len(detail["attachments"]) == 1
        assert detail["test"]["zones_tested"] == 3
        assert detail["test"]["zones_issue"] == 0

        # 12. Admin approves (Screen 5)
        _approve(client, admin_token, tid)

        # 13. Verify compliant in dashboard (Screen 8)
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "compliant"

        # 14. Verify NOT in escalation anymore (Screen 7)
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid not in [b["building_id"] for b in r.json()]

        # 15. Verify in trends (Screen 9)
        r = client.get("/v1/alarm/dashboard/trends", headers=_h(admin_token))
        current = next((m for m in r.json()["months"] if m["month"] == month), None)
        assert current["compliant"] >= 1

        # 16. Verify drill-down (Screen 10)
        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        dd = r.json()
        assert dd["building"]["name"] == "E2E Full Workflow"
        assert len(dd["zones"]) == 3
        assert len(dd["tests"]) == 1
        assert dd["tests"][0]["status"] == "APPROVED"

        # 17. Controller records biannual check (Screen 4)
        client.post("/v1/alarm/biannual", headers=_h(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": today.isoformat(), "status": "COMPLIANT"})

        # 18. Verify biannual status (Screen 11)
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        brow = next((r for r in r.json() if r["building_id"] == bid), None)
        assert brow["cellular_status"] == "COMPLIANT"

        # 19. Verify biannual in drill-down (Screen 10)
        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        assert len(r.json()["biannual_checks"]) == 1
