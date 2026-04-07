"""
End-to-end scenarios that span multiple screens simulating real user workflows.

Each test simulates a complete business scenario as a user would experience it,
touching 5+ screens in sequence with verification at each step.
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


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 1: New building onboarding — admin sets everything up
# Screens: 13 → 12 → 15 → 14 → 8 → 7
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_NewBuildingOnboarding:
    """Admin onboards a new building: create building, add zones, grant access,
    configure rules, verify it appears overdue in dashboard and escalation."""

    def test_full_onboarding(self, client, admin_token, controller_token):
        # ── Screen 13: Building Setup ──
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token), json={
            "name": "Tampa Bay Distribution Center",
            "region": "Southeast",
            "security_company_name": "SecureWatch Inc",
            "security_customer_id": "SW-4472",
            "security_company_phone": "813-555-0199",
            "status": "active",
        })
        assert r.status_code == 201
        bid = r.json()["id"]
        assert r.json()["security_customer_id"] == "SW-4472"

        # ── Screen 12: Zone Configuration ──
        zone_data = [
            {"building_id": bid, "zone_number": 1, "zone_name": "Main Entrance", "zone_type": "ENTRY_EXIT", "area_number": 1},
            {"building_id": bid, "zone_number": 2, "zone_name": "Loading Dock Door", "zone_type": "ENTRY_EXIT", "area_number": 1},
            {"building_id": bid, "zone_number": 3, "zone_name": "Warehouse Motion N", "zone_type": "INTERIOR_MOTION", "area_number": 1},
            {"building_id": bid, "zone_number": 4, "zone_name": "Warehouse Motion S", "zone_type": "INTERIOR_MOTION", "area_number": 1},
            {"building_id": bid, "zone_number": 5, "zone_name": "Office Panic Button", "zone_type": "PANIC_SILENT", "area_number": 2},
            {"building_id": bid, "zone_number": 6, "zone_name": "Cooler Panic", "zone_type": "PANIC_SILENT", "area_number": 2},
            {"building_id": bid, "zone_number": 7, "zone_name": "Server Room Fire", "zone_type": "FIRE_SMOKE", "area_number": 2},
        ]
        r = client.post("/v1/alarm/zones/import", headers=_h(admin_token),
            json={"zones": zone_data})
        assert r.status_code == 201
        assert r.json()["imported"] == 7
        zone_ids = [z["id"] for z in r.json()["zones"]]

        # Verify zones in list
        r = client.get(f"/v1/alarm/zones?building_id={bid}", headers=_h(admin_token))
        assert len(r.json()) == 7
        types = [z["zone_type"] for z in r.json()]
        assert "FIRE_SMOKE" in types

        # ── Screen 15: User Access ──
        users = client.get("/v1/alarm/users", headers=_h(admin_token)).json()
        ctrl_user = next(u for u in users if u["role"] == "CONTROLLER")
        rc_user = next(u for u in users if u["role"] == "REGIONAL_CONTROLLER")

        # Grant tester access to controller
        r = client.post("/v1/alarm/access", headers=_h(admin_token), json={
            "user_id": ctrl_user["id"], "access_type": "tester",
            "building_ids": [bid], "notes": "Primary tester for Tampa",
        })
        assert r.status_code == 201

        # Grant approver access to RC
        r = client.post("/v1/alarm/access", headers=_h(admin_token), json={
            "user_id": rc_user["id"], "access_type": "approver",
            "building_ids": [bid], "notes": "Southeast approver",
        })
        assert r.status_code == 201

        # Verify access list
        r = client.get("/v1/alarm/access", headers=_h(admin_token))
        grants = [g for g in r.json() if bid in g["building_ids"]]
        assert len(grants) >= 2

        # ── Screen 14: Compliance Rules (verify defaults) ──
        r = client.get("/v1/alarm/rules", headers=_h(admin_token))
        assert r.json()["monthly_deadline_day"] == 28 or r.json()["monthly_deadline_day"] > 0

        # ── Screen 8: Dashboard — new building should be overdue ──
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row is not None
        assert row["status"] == "overdue"
        assert row["region"] == "Southeast"

        # ── Screen 7: Escalation — building should be overdue ──
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        esc = next((b for b in r.json() if b["building_id"] == bid), None)
        assert esc is not None
        assert esc["building_name"] == "Tampa Bay Distribution Center"

        # ── Screen 10: Drill-down ──
        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        dd = r.json()
        assert dd["building"]["name"] == "Tampa Bay Distribution Center"
        assert len(dd["zones"]) == 7
        assert len(dd["tests"]) == 0
        assert len(dd["biannual_checks"]) == 0


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 2: Tester monthly workflow — test, upload, submit, get approved
# Screens: 1 → 2 → 1 → 5 → 6 → 8 → 9 → 10
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_TesterMonthlyWorkflow:
    """Controller conducts monthly alarm test: create test, mark zones,
    upload report, submit, admin reviews and approves, dashboard updates."""

    def test_monthly_test_flow(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Setup: building + zones
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "Wausau Canteen Monthly", "region": "Midwest"})
        bid = r.json()["id"]

        zones = []
        for i, (name, ztype) in enumerate([
            ("Main Entry Door", "ENTRY_EXIT"),
            ("South Hallway Motion", "INTERIOR_MOTION"),
            ("North Hallway Motion", "INTERIOR_MOTION"),
            ("Office Motion", "INTERIOR_MOTION"),
            ("Cooler Panic", "PANIC_SILENT"),
            ("Freezer Panic", "PANIC_SILENT"),
            ("Front Office Panic", "PANIC_SILENT"),
        ], start=1):
            r = client.post("/v1/alarm/zones", headers=_h(admin_token),
                json={"building_id": bid, "zone_number": i, "zone_name": name, "zone_type": ztype, "area_number": 1})
            zones.append(r.json()["id"])

        # ── Screen 1: Create test (draft) ──
        r = client.post("/v1/alarm/tests", headers=_h(controller_token), json={
            "building_id": bid,
            "test_date": today.isoformat(),
            "test_month": month,
            "test_start_time": "10:59",
            "notes": "Monthly alarm test — all zones",
        })
        assert r.status_code == 201
        tid = r.json()["id"]
        assert r.json()["status"] == "DRAFT"
        assert r.json()["tester_name"] == "Chris Controller"

        # ── Screen 1: Save zone results (all tested, one issue) ──
        results = {}
        for zid in zones[:-1]:  # all but last
            results[zid] = {"result": "TESTED", "notes": ""}
        results[zones[-1]] = {"result": "ISSUE_FOUND", "notes": "Panic button required extra press"}

        r = client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": results})
        assert r.status_code == 200

        # Verify zone counts
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert r.json()["test"]["zones_total"] == 7
        assert r.json()["test"]["zones_tested"] == 6
        assert r.json()["test"]["zones_issue"] == 1

        # ── Screen 2: Upload security company report ──
        pdf_content = b"%PDF-1.4 Customer Activity Report - AES9925 - Monthly Test"
        r = client.post(f"/v1/alarm/tests/{tid}/attachments", headers=_h(controller_token),
            files={"file": ("AES9925_April_2026.pdf", io.BytesIO(pdf_content), "application/pdf")})
        assert r.status_code == 201
        assert r.json()["file_name"] == "AES9925_April_2026.pdf"
        assert r.json()["file_type"] == "PDF"

        # ── Screen 1: Submit for approval ──
        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        assert r.status_code == 200
        assert r.json()["status"] == "SUBMITTED"
        assert r.json()["submitted_at"] is not None

        # ── Screen 8: Dashboard should show pending ──
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "pending"

        # ── Screen 5: Approvals list — should appear ──
        r = client.get("/v1/alarm/tests?status=SUBMITTED", headers=_h(admin_token))
        submitted_bids = [t["building_id"] for t in r.json()]
        assert bid in submitted_bids

        # ── Screen 6: Review detail — zones + attachments ──
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(admin_token))
        detail = r.json()
        assert detail["test"]["status"] == "SUBMITTED"
        assert len(detail["zones"]) == 7
        assert len(detail["attachments"]) == 1
        issue_zones = [z for z in detail["zones"] if z["result"] == "ISSUE_FOUND"]
        assert len(issue_zones) == 1

        # ── Screen 6: Admin approves ──
        r = client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(admin_token),
            json={"notes": "Issue noted but acceptable — maintenance scheduled"})
        assert r.json()["status"] == "APPROVED"
        assert r.json()["approved_by_name"] == "Adam Admin"

        # ── Screen 8: Dashboard now compliant ──
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next((b for b in r.json()["buildings"] if b["building_id"] == bid), None)
        assert row["status"] == "compliant"

        # ── Screen 9: Trends should reflect this month ──
        r = client.get("/v1/alarm/dashboard/trends", headers=_h(admin_token))
        this_month = next((m for m in r.json()["months"] if m["month"] == month), None)
        assert this_month["compliant"] >= 1

        # ── Screen 10: Drill-down shows approved test ──
        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        assert len(r.json()["tests"]) == 1
        assert r.json()["tests"][0]["status"] == "APPROVED"


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 3: Rejection → Fix → Resubmit cycle
# Screens: 1 → 1 → 5 → 6 → 1 → 1 → 5 → 6 → 8
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_RejectionFixResubmit:
    """Test is rejected twice before final approval. Zone results updated each time."""

    def test_double_rejection_then_approve(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Setup
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "Chicago Rejection Test", "region": "Midwest"})
        bid = r.json()["id"]
        z1 = client.post("/v1/alarm/zones", headers=_h(admin_token),
            json={"building_id": bid, "zone_number": 1, "zone_name": "Front Door", "zone_type": "ENTRY_EXIT", "area_number": 1}).json()["id"]
        z2 = client.post("/v1/alarm/zones", headers=_h(admin_token),
            json={"building_id": bid, "zone_number": 2, "zone_name": "Back Panic", "zone_type": "PANIC_SILENT", "area_number": 1}).json()["id"]

        # ── Attempt 1: Submit with missing zone ──
        tid = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": bid, "test_date": today.isoformat(), "test_month": month}).json()["id"]

        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}, z2: {"result": "NOT_TESTED", "notes": ""}}})
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))

        # Admin rejects: "Zone 2 not tested"
        r = client.post(f"/v1/alarm/tests/{tid}/reject", headers=_h(admin_token),
            json={"reason": "Zone 2 (Back Panic) not tested — please complete all zones"})
        assert r.json()["rejection_reason"] == "Zone 2 (Back Panic) not tested — please complete all zones"

        # Dashboard: overdue
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        assert next(b for b in r.json()["buildings"] if b["building_id"] == bid)["status"] == "overdue"

        # ── Attempt 2: Reopen, test zone 2 as issue, resubmit ──
        client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_h(controller_token))
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}, z2: {"result": "ISSUE_FOUND", "notes": "Button jammed"}}})
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))

        # Verify zone update
        detail = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token)).json()
        assert detail["test"]["zones_issue"] == 1

        # Admin rejects again: "Issue not resolved"
        client.post(f"/v1/alarm/tests/{tid}/reject", headers=_h(admin_token),
            json={"reason": "Panic button issue needs maintenance ticket before approval"})

        # ── Attempt 3: Reopen, fix, all tested, resubmit ──
        client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_h(controller_token))
        client.post(f"/v1/alarm/tests/{tid}/zones", headers=_h(controller_token),
            json={"results": {z1: {"result": "TESTED", "notes": ""}, z2: {"result": "TESTED", "notes": "Fixed and retested after maintenance"}}})
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))

        # Verify all tested now
        detail = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token)).json()
        assert detail["test"]["zones_tested"] == 2
        assert detail["test"]["zones_issue"] == 0

        # Admin approves
        r = client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(admin_token),
            json={"notes": "All zones now tested. Maintenance ticket #4472 attached."})
        assert r.json()["status"] == "APPROVED"

        # Dashboard: compliant
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        assert next(b for b in r.json()["buildings"] if b["building_id"] == bid)["status"] == "compliant"


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 4: Biannual compliance cycle
# Screens: 4 → 11 → 10 → 4 → 11
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_BiannualCycle:
    """Building goes through cellular + camera biannual checks across multiple periods."""

    def test_biannual_lifecycle(self, client, admin_token, controller_token):
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "Orlando Biannual", "region": "Southeast"})
        bid = r.json()["id"]

        # ── Screen 11: Initially no checks ──
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next(r for r in r.json() if r["building_id"] == bid)
        assert row["cellular_status"] == "NO_CHECK"
        assert row["camera_status"] == "NO_CHECK"

        # ── Screen 4: First cellular check (compliant) ──
        r = client.post("/v1/alarm/biannual", headers=_h(controller_token), json={
            "building_id": bid, "check_type": "CELLULAR_BACKUP",
            "check_date": "2026-01-15", "status": "COMPLIANT",
            "notes": "Cellular backup verified — signal strong",
        })
        assert r.json()["next_due_date"] == "2026-07-15"

        # ── Screen 11: Cellular compliant, camera still missing ──
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next(r for r in r.json() if r["building_id"] == bid)
        assert row["cellular_status"] == "COMPLIANT"
        assert row["cellular_next_due"] == "2026-07-15"
        assert row["camera_status"] == "NO_CHECK"

        # ── Screen 4: Camera check (non-compliant — only 20 days) ──
        r = client.post("/v1/alarm/biannual", headers=_h(controller_token), json={
            "building_id": bid, "check_type": "CAMERA_BACKUP",
            "check_date": "2026-02-01", "status": "NON_COMPLIANT",
            "days_verified": 20,
            "notes": "Only 20 days of footage — hard drive issue",
        })
        assert r.json()["status"] == "NON_COMPLIANT"

        # ── Screen 11: Mixed state ──
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next(r for r in r.json() if r["building_id"] == bid)
        assert row["cellular_status"] == "COMPLIANT"
        assert row["camera_status"] == "NON_COMPLIANT"

        # ── Screen 10: Drill-down shows both checks ──
        r = client.get(f"/v1/alarm/dashboard/building/{bid}", headers=_h(admin_token))
        checks = r.json()["biannual_checks"]
        assert len(checks) == 2
        types = {c["check_type"] for c in checks}
        assert types == {"CELLULAR_BACKUP", "CAMERA_BACKUP"}

        # ── Screen 4: Fix camera (compliant now) ──
        r = client.post("/v1/alarm/biannual", headers=_h(controller_token), json={
            "building_id": bid, "check_type": "CAMERA_BACKUP",
            "check_date": "2026-03-01", "status": "COMPLIANT",
            "days_verified": 32,
            "notes": "Hard drive replaced — 32 days verified",
        })

        # ── Screen 11: Both compliant ──
        r = client.get("/v1/alarm/biannual/status", headers=_h(admin_token))
        row = next(r for r in r.json() if r["building_id"] == bid)
        assert row["cellular_status"] == "COMPLIANT"
        assert row["camera_status"] == "COMPLIANT"

        # ── Screen 4: Verify full history ──
        r = client.get(f"/v1/alarm/biannual?building_id={bid}", headers=_h(controller_token))
        assert len(r.json()) == 3  # 1 cellular + 2 camera


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 5: Escalation workflow — overdue → reminder → test → resolve
# Screens: 13 → 7 → 7 → 1 → 5 → 7 → 8
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_EscalationWorkflow:
    """Building becomes overdue, admin sends reminders, tester finally completes."""

    def test_escalation_to_resolution(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # ── Screen 13: Create building ──
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "Atlanta Escalation", "region": "Southeast"})
        bid = r.json()["id"]

        # ── Screen 7: Verify overdue ──
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        esc = next((b for b in r.json() if b["building_id"] == bid), None)
        assert esc is not None
        assert esc["days_since_last_test"] == 999  # never tested

        # ── Screen 7: Send tier 1 reminder ──
        r = client.post("/v1/alarm/escalation/remind", headers=_h(admin_token),
            json={"building_id": bid, "tier": 1})
        assert r.json()["sent"] is True
        assert r.json()["tier"] == 1

        # ── Screen 7: Escalate to tier 2 ──
        r = client.post("/v1/alarm/escalation/remind", headers=_h(admin_token),
            json={"building_id": bid, "tier": 2})
        assert r.json()["tier"] == 2

        # ── Screen 1: Tester finally creates and submits test ──
        tid = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": bid, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))

        # ── Screen 5+6: Admin approves ──
        client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(admin_token),
            json={"notes": "Finally submitted"})

        # ── Screen 7: No longer overdue ──
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid not in [b["building_id"] for b in r.json()]

        # ── Screen 8: Compliant ──
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        row = next(b for b in r.json()["buildings"] if b["building_id"] == bid)
        assert row["status"] == "compliant"


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 6: Multi-region compliance review
# Screens: 13 → 1 → 5 → 8 → 9 → 8(filtered)
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_MultiRegionReview:
    """RC reviews compliance across regions — some compliant, some overdue."""

    def test_multi_region_dashboard(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Create buildings in 3 regions
        b_mw = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "MW Compliant", "region": "Midwest"}).json()["id"]
        b_se = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "SE Overdue", "region": "Southeast"}).json()["id"]
        b_ne = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "NE Pending", "region": "Northeast"}).json()["id"]

        # MW: approved
        tid = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": b_mw, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(admin_token), json={"notes": "OK"})

        # NE: submitted (pending)
        tid2 = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": b_ne, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{tid2}/submit", headers=_h(controller_token))

        # SE: no test (overdue)

        # ── Screen 8: Full dashboard ──
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        state_map = {b["building_id"]: b["status"] for b in r.json()["buildings"]}
        assert state_map[b_mw] == "compliant"
        assert state_map[b_se] == "overdue"
        assert state_map[b_ne] == "pending"

        # ── Screen 8: Filter by Midwest ──
        r = client.get("/v1/alarm/dashboard/overview?region=Midwest", headers=_h(admin_token))
        bids = [b["building_id"] for b in r.json()["buildings"]]
        assert b_mw in bids
        assert b_se not in bids
        assert b_ne not in bids

        # ── Screen 8: Filter by Southeast ──
        r = client.get("/v1/alarm/dashboard/overview?region=Southeast", headers=_h(admin_token))
        bids = [b["building_id"] for b in r.json()["buildings"]]
        assert b_se in bids
        assert b_mw not in bids

        # ── Screen 9: Trends show mixed compliance ──
        r = client.get("/v1/alarm/dashboard/trends", headers=_h(admin_token))
        this_month = next(m for m in r.json()["months"] if m["month"] == month)
        assert this_month["compliant"] >= 1
        assert this_month["total"] >= 3


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 7: Building lifecycle — active → exempt → active → test
# Screens: 13 → 8 → 7 → 13 → 8 → 7 → 13 → 1 → 5 → 8
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_BuildingLifecycle:
    """Building goes through status changes and each state is reflected everywhere."""

    def test_building_status_journey(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Create active building
        r = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "Boston Lifecycle", "region": "Northeast"})
        bid = r.json()["id"]

        # Active → overdue in dashboard and escalation
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        assert next(b for b in r.json()["buildings"] if b["building_id"] == bid)["status"] == "overdue"
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid in [b["building_id"] for b in r.json()]

        # Change to exempt (renovation)
        client.put(f"/v1/alarm/buildings/{bid}", headers=_h(admin_token),
            json={"status": "temporarily_exempt", "exempt_reason": "Major renovation Q2"})

        # Exempt → not in escalation, shows exempt in dashboard
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid not in [b["building_id"] for b in r.json()]
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        assert next(b for b in r.json()["buildings"] if b["building_id"] == bid)["status"] == "exempt"

        # Reactivate
        client.put(f"/v1/alarm/buildings/{bid}", headers=_h(admin_token),
            json={"status": "active", "exempt_reason": None})

        # Back to overdue
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid in [b["building_id"] for b in r.json()]

        # Complete a test
        tid = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": bid, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(controller_token))
        client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(admin_token), json={"notes": "OK"})

        # Now compliant
        r = client.get("/v1/alarm/dashboard/overview", headers=_h(admin_token))
        assert next(b for b in r.json()["buildings"] if b["building_id"] == bid)["status"] == "compliant"
        r = client.get("/v1/alarm/escalation/overdue", headers=_h(admin_token))
        assert bid not in [b["building_id"] for b in r.json()]


# ══════════════════════════════════════════════════════════════════════════════
# Scenario 8: Test history filtering across screens
# Screens: 1 → 3 → 5 → 3 → 3
# ══════════════════════════════════════════════════════════════════════════════

class TestScenario_TestHistoryFiltering:
    """Multiple tests created, verify history filters work correctly."""

    def test_history_filters(self, client, admin_token, controller_token):
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

        # Setup 2 buildings
        b1 = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "History Bld 1", "region": "Midwest"}).json()["id"]
        b2 = client.post("/v1/alarm/buildings", headers=_h(admin_token),
            json={"name": "History Bld 2", "region": "Southeast"}).json()["id"]

        # Create tests in different states
        t1 = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": b1, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        # t1 stays DRAFT

        t2 = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": b2, "test_date": today.isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{t2}/submit", headers=_h(controller_token))
        # t2 is SUBMITTED

        t3 = client.post("/v1/alarm/tests", headers=_h(controller_token),
            json={"building_id": b1, "test_date": (today - timedelta(days=1)).isoformat(), "test_month": month}).json()["id"]
        client.post(f"/v1/alarm/tests/{t3}/submit", headers=_h(controller_token))
        client.post(f"/v1/alarm/tests/{t3}/approve", headers=_h(admin_token), json={"notes": "OK"})
        # t3 is APPROVED

        # ── Screen 3: Filter by building ──
        r = client.get(f"/v1/alarm/tests?building_id={b1}", headers=_h(controller_token))
        bids = {t["building_id"] for t in r.json()}
        assert bids == {b1}

        # ── Screen 3: Filter by status DRAFT ──
        r = client.get("/v1/alarm/tests?status=DRAFT", headers=_h(controller_token))
        assert all(t["status"] == "DRAFT" for t in r.json())
        assert t1 in [t["id"] for t in r.json()]

        # ── Screen 3: Filter by status SUBMITTED ──
        r = client.get("/v1/alarm/tests?status=SUBMITTED", headers=_h(controller_token))
        assert all(t["status"] == "SUBMITTED" for t in r.json())

        # ── Screen 3: Filter by month ──
        r = client.get(f"/v1/alarm/tests?month={month}", headers=_h(controller_token))
        assert all(t["test_month"] == month for t in r.json())

        # ── Screen 3: Combined filters ──
        r = client.get(f"/v1/alarm/tests?building_id={b1}&status=APPROVED", headers=_h(controller_token))
        for t in r.json():
            assert t["building_id"] == b1
            assert t["status"] == "APPROVED"
