"""
TDD: Alarm Tests — Screens 1, 3, 5, 6 (Test Form, History, Approvals, Review)
Core alarm test lifecycle: create, save zones, submit, approve, reject, reopen.

API Endpoints:
  GET    /v1/alarm/tests                         — List tests (with filters)
  POST   /v1/alarm/tests                         — Create a test (draft)
  GET    /v1/alarm/tests/{id}                    — Get test with zones + attachments
  PUT    /v1/alarm/tests/{id}                    — Update test metadata
  POST   /v1/alarm/tests/{id}/zones              — Save zone results
  POST   /v1/alarm/tests/{id}/submit             — Submit for approval
  POST   /v1/alarm/tests/{id}/approve            — Approve (admin/RC only)
  POST   /v1/alarm/tests/{id}/reject             — Reject with reason (admin/RC only)
  POST   /v1/alarm/tests/{id}/reopen             — Reopen rejected test as draft
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def setup_building_and_zones(client):
    """Create a building with 3 zones for test use."""
    alarm_admin_token = _auth(client, "alarmadmin@alarm.compass.com")
    alarm_approver_token = _auth(client, "approver@alarm.compass.com")
    h = _headers(alarm_admin_token)

    # Building
    r = client.post("/v1/alarm/buildings", headers=h,
        json={"name": "Alarm Test Building", "region": "Midwest"})
    bid = r.json()["id"]

    # 3 zones
    zone_ids = []
    for i, (name, ztype) in enumerate([
        ("Main Entry Door", "ENTRY_EXIT"),
        ("Hallway Motion", "INTERIOR_MOTION"),
        ("Cooler Panic", "PANIC_SILENT"),
    ], start=1):
        r = client.post("/v1/alarm/zones", headers=h,
            json={"building_id": bid, "zone_number": i, "zone_name": name, "zone_type": ztype, "area_number": 1})
        zone_ids.append(r.json()["id"])

    return {"building_id": bid, "zone_ids": zone_ids, "alarm_admin_token": alarm_admin_token, "alarm_approver_token": alarm_approver_token}


# ── Create Test (Draft) ─────────────────────────────────────────────────────

class TestCreateAlarmTest:
    """POST /v1/alarm/tests"""

    def test_create_draft(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={
                "building_id": bid,
                "test_date": "2026-04-08",
                "test_month": "2026-04",
                "notes": "Monthly alarm test",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "DRAFT"
        assert body["building_id"] == bid
        assert body["test_date"] == "2026-04-08"
        assert body["test_month"] == "2026-04"
        assert "id" in body
        assert "tester_name" in body

    def test_unauthenticated_cannot_create(self, client, setup_building_and_zones):
        r = client.post("/v1/alarm/tests", json={
            "building_id": setup_building_and_zones["building_id"],
            "test_date": "2026-04-08", "test_month": "2026-04",
        })
        assert r.status_code in (401, 403)


# ── List Tests ───────────────────────────────────────────────────────────────

class TestListAlarmTests:
    """GET /v1/alarm/tests"""

    def test_list_all(self, client, alarm_tester_token, setup_building_and_zones):
        r = client.get("/v1/alarm/tests", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_building(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.get(f"/v1/alarm/tests?building_id={bid}", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        for t in r.json():
            assert t["building_id"] == bid

    def test_filter_by_status(self, client, alarm_tester_token):
        r = client.get("/v1/alarm/tests?status=DRAFT", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "DRAFT"

    def test_filter_by_month(self, client, alarm_tester_token):
        r = client.get("/v1/alarm/tests?month=2026-04", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        for t in r.json():
            assert t["test_month"] == "2026-04"


# ── Get Test Detail ──────────────────────────────────────────────────────────

class TestGetAlarmTest:
    """GET /v1/alarm/tests/{id}"""

    def test_get_with_zones_and_attachments(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        # Create a test
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-09", "test_month": "2026-04"},
        )
        tid = r.json()["id"]

        # Get detail
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        body = r.json()
        assert body["test"]["id"] == tid
        assert "zones" in body
        assert "attachments" in body
        assert isinstance(body["zones"], list)
        assert isinstance(body["attachments"], list)

    def test_get_nonexistent_returns_404(self, client, alarm_tester_token):
        r = client.get("/v1/alarm/tests/nonexistent", headers=_headers(alarm_tester_token))
        assert r.status_code == 404


# ── Save Zone Results ────────────────────────────────────────────────────────

class TestSaveZoneResults:
    """POST /v1/alarm/tests/{id}/zones"""

    def test_save_zone_results(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        zids = setup_building_and_zones["zone_ids"]

        # Create test
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-10", "test_month": "2026-04"},
        )
        tid = r.json()["id"]

        # Save zone results
        results = {
            zids[0]: {"result": "TESTED", "notes": ""},
            zids[1]: {"result": "TESTED", "notes": "Sensor triggered on first pass"},
            zids[2]: {"result": "ISSUE_FOUND", "notes": "Button stuck — maintenance requested"},
        }
        r = client.post(f"/v1/alarm/tests/{tid}/zones",
            headers=_headers(alarm_tester_token),
            json={"results": results},
        )
        assert r.status_code == 200

        # Verify saved via get detail
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_headers(alarm_tester_token))
        zones = r.json()["zones"]
        assert len(zones) == 3
        zone_map = {z["alarm_zone_id"]: z for z in zones}
        assert zone_map[zids[0]]["result"] == "TESTED"
        assert zone_map[zids[2]]["result"] == "ISSUE_FOUND"
        assert zone_map[zids[2]]["notes"] == "Button stuck — maintenance requested"


# ── Submit for Approval ──────────────────────────────────────────────────────

class TestSubmitAlarmTest:
    """POST /v1/alarm/tests/{id}/submit"""

    def test_submit_draft(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-11", "test_month": "2026-04"},
        )
        tid = r.json()["id"]

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert r.json()["status"] == "SUBMITTED"
        assert r.json()["submitted_at"] is not None

    def test_cannot_submit_already_submitted(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-12", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))

        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        assert r.status_code == 400


# ── Approve Test ─────────────────────────────────────────────────────────────

class TestApproveAlarmTest:
    """POST /v1/alarm/tests/{id}/approve"""

    def test_admin_can_approve(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_admin_token = setup_building_and_zones["alarm_admin_token"]
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]

        # Create + submit
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-13", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))

        # Approve
        r = client.post(f"/v1/alarm/tests/{tid}/approve",
            headers=_headers(alarm_approver_token),
            json={"notes": "All checks passed"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"
        assert r.json()["approved_at"] is not None

    def test_controller_cannot_approve(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-14", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))

        r = client.post(f"/v1/alarm/tests/{tid}/approve",
            headers=_headers(alarm_tester_token),
            json={"notes": "Self-approve attempt"},
        )
        assert r.status_code == 403

    def test_cannot_approve_draft(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]

        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-15", "test_month": "2026-04"},
        )
        tid = r.json()["id"]

        r = client.post(f"/v1/alarm/tests/{tid}/approve",
            headers=_headers(alarm_approver_token),
            json={"notes": "Approve draft?"},
        )
        assert r.status_code == 400


# ── Reject Test ──────────────────────────────────────────────────────────────

class TestRejectAlarmTest:
    """POST /v1/alarm/tests/{id}/reject"""

    def test_admin_can_reject_with_reason(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]

        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-16", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))

        r = client.post(f"/v1/alarm/tests/{tid}/reject",
            headers=_headers(alarm_approver_token),
            json={"reason": "Zone 3 panic button not tested — please retest"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"
        assert r.json()["rejection_reason"] == "Zone 3 panic button not tested — please retest"

    def test_reject_requires_reason(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]

        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-17", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))

        r = client.post(f"/v1/alarm/tests/{tid}/reject",
            headers=_headers(alarm_approver_token),
            json={},
        )
        assert r.status_code == 422


# ── Reopen Rejected Test ─────────────────────────────────────────────────────

class TestReopenAlarmTest:
    """POST /v1/alarm/tests/{id}/reopen"""

    def test_reopen_rejected_to_draft(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]

        # Create + submit + reject
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-18", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        client.post(f"/v1/alarm/tests/{tid}/reject",
            headers=_headers(alarm_approver_token),
            json={"reason": "Missing zones"})

        # Reopen
        r = client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert r.json()["status"] == "DRAFT"
        assert r.json()["rejection_reason"] is None

    def test_cannot_reopen_non_rejected(self, client, alarm_tester_token, setup_building_and_zones):
        bid = setup_building_and_zones["building_id"]
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-19", "test_month": "2026-04"},
        )
        tid = r.json()["id"]

        # Draft — cannot reopen
        r = client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_headers(alarm_tester_token))
        assert r.status_code == 400


# ── Full Lifecycle E2E ───────────────────────────────────────────────────────

class TestFullLifecycle:
    """Create → save zones → submit → reject → reopen → resubmit → approve"""

    def test_complete_lifecycle(self, client, alarm_tester_token, setup_building_and_zones):
        alarm_admin_token = setup_building_and_zones["alarm_admin_token"]
        alarm_approver_token = setup_building_and_zones["alarm_approver_token"]
        bid = setup_building_and_zones["building_id"]
        zids = setup_building_and_zones["zone_ids"]

        # 1. Create draft
        r = client.post("/v1/alarm/tests",
            headers=_headers(alarm_tester_token),
            json={"building_id": bid, "test_date": "2026-04-20", "test_month": "2026-04"},
        )
        tid = r.json()["id"]
        assert r.json()["status"] == "DRAFT"

        # 2. Save zone results
        results = {zid: {"result": "TESTED", "notes": ""} for zid in zids}
        client.post(f"/v1/alarm/tests/{tid}/zones",
            headers=_headers(alarm_tester_token), json={"results": results})

        # 3. Submit
        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        assert r.json()["status"] == "SUBMITTED"

        # 4. Reject
        r = client.post(f"/v1/alarm/tests/{tid}/reject",
            headers=_headers(alarm_approver_token),
            json={"reason": "Need to retest zone 3"})
        assert r.json()["status"] == "REJECTED"

        # 5. Reopen
        r = client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_headers(alarm_tester_token))
        assert r.json()["status"] == "DRAFT"

        # 6. Re-submit
        r = client.post(f"/v1/alarm/tests/{tid}/submit", headers=_headers(alarm_tester_token))
        assert r.json()["status"] == "SUBMITTED"

        # 7. Approve
        r = client.post(f"/v1/alarm/tests/{tid}/approve",
            headers=_headers(alarm_approver_token), json={"notes": "All good now"})
        assert r.json()["status"] == "APPROVED"
