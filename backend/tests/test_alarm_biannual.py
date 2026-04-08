"""
TDD: Biannual Checks — Screen 4
Cellular backup and camera backup verification checks with approval workflow.

API Endpoints:
  GET  /v1/alarm/biannual                  — List checks (optional building_id filter)
  POST /v1/alarm/biannual                  — Create a check (starts as DRAFT)
  POST /v1/alarm/biannual/{id}/submit      — Submit for approval
  POST /v1/alarm/biannual/{id}/approve     — Approve (admin/RC only)
  POST /v1/alarm/biannual/{id}/reject      — Reject with reason (admin/RC only)
  POST /v1/alarm/biannual/{id}/reopen      — Reopen rejected check
  GET  /v1/alarm/biannual/status           — All buildings' biannual status summary
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


def _create_check(client, token: str, bid: str, check_type: str = "CELLULAR_BACKUP",
                   check_date: str = "2026-04-08", status: str = "COMPLIANT") -> str:
    r = client.post("/v1/alarm/biannual",
        headers=_headers(token),
        json={"building_id": bid, "check_type": check_type,
              "check_date": check_date, "status": status})
    assert r.status_code == 201
    return r.json()["id"]


# ── Create Check (starts as DRAFT) ──────────────────────────────────────────

class TestCreateBiannualCheck:
    def test_create_starts_as_draft(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Create Draft")
        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CELLULAR_BACKUP",
                  "check_date": "2026-04-08", "status": "COMPLIANT",
                  "notes": "Cellular backup verified OK"})
        assert r.status_code == 201
        body = r.json()
        assert body["approval_status"] == "DRAFT"
        assert body["check_type"] == "CELLULAR_BACKUP"
        assert body["status"] == "COMPLIANT"
        assert body["next_due_date"] is not None
        assert body["checked_by_name"] == "Chris Controller"

    def test_create_camera(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Create Camera")
        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"building_id": bid, "check_type": "CAMERA_BACKUP",
                  "check_date": "2026-04-08", "status": "COMPLIANT", "days_verified": 30})
        assert r.status_code == 201
        assert r.json()["approval_status"] == "DRAFT"

    def test_unauthenticated_fails(self, client):
        r = client.post("/v1/alarm/biannual", json={
            "building_id": "x", "check_type": "CELLULAR_BACKUP",
            "check_date": "2026-04-08", "status": "COMPLIANT"})
        assert r.status_code in (401, 403)

    def test_missing_fields_fails(self, client, controller_token):
        r = client.post("/v1/alarm/biannual",
            headers=_headers(controller_token),
            json={"check_type": "CELLULAR_BACKUP"})
        assert r.status_code == 422


# ── Submit ───────────────────────────────────────────────────────────────────

class TestSubmitBiannualCheck:
    def test_submit_draft(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Submit")
        cid = _create_check(client, controller_token, bid)

        r = client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        assert r.status_code == 200
        assert r.json()["approval_status"] == "SUBMITTED"
        assert r.json()["submitted_at"] is not None

    def test_cannot_submit_twice(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Double Submit")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        assert r.status_code == 400


# ── Approve ──────────────────────────────────────────────────────────────────

class TestApproveBiannualCheck:
    def test_admin_can_approve(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Approve")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.post(f"/v1/alarm/biannual/{cid}/approve",
            headers=_headers(admin_token), json={"notes": "Looks good"})
        assert r.status_code == 200
        assert r.json()["approval_status"] == "APPROVED"
        assert r.json()["approved_by_name"] == "Adam Admin"
        assert r.json()["approved_at"] is not None

    def test_controller_cannot_approve(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Ctrl Approve")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.post(f"/v1/alarm/biannual/{cid}/approve",
            headers=_headers(controller_token), json={"notes": "self"})
        assert r.status_code == 403

    def test_cannot_approve_draft(self, client, admin_token):
        bid = _create_building(client, admin_token, "Bi Approve Draft")
        cid = _create_check(client, admin_token, bid)

        r = client.post(f"/v1/alarm/biannual/{cid}/approve",
            headers=_headers(admin_token), json={"notes": "x"})
        assert r.status_code == 400


# ── Reject ───────────────────────────────────────────────────────────────────

class TestRejectBiannualCheck:
    def test_reject_with_reason(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Reject")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.post(f"/v1/alarm/biannual/{cid}/reject",
            headers=_headers(admin_token), json={"reason": "Evidence unclear"})
        assert r.status_code == 200
        assert r.json()["approval_status"] == "REJECTED"
        assert r.json()["rejection_reason"] == "Evidence unclear"

    def test_reject_requires_reason(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Reject NoReason")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.post(f"/v1/alarm/biannual/{cid}/reject",
            headers=_headers(admin_token), json={})
        assert r.status_code == 422


# ── Reopen ───────────────────────────────────────────────────────────────────

class TestReopenBiannualCheck:
    def test_reopen_rejected(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Reopen")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        client.post(f"/v1/alarm/biannual/{cid}/reject",
            headers=_headers(admin_token), json={"reason": "Redo"})

        r = client.post(f"/v1/alarm/biannual/{cid}/reopen", headers=_headers(controller_token))
        assert r.status_code == 200
        assert r.json()["approval_status"] == "DRAFT"
        assert r.json()["rejection_reason"] is None

    def test_cannot_reopen_non_rejected(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Reopen Fail")
        cid = _create_check(client, controller_token, bid)

        r = client.post(f"/v1/alarm/biannual/{cid}/reopen", headers=_headers(controller_token))
        assert r.status_code == 400


# ── Full Lifecycle ───────────────────────────────────────────────────────────

class TestBiannualLifecycle:
    def test_create_submit_reject_reopen_submit_approve(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Lifecycle")
        cid = _create_check(client, controller_token, bid)

        # Submit
        r = client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        assert r.json()["approval_status"] == "SUBMITTED"

        # Reject
        r = client.post(f"/v1/alarm/biannual/{cid}/reject",
            headers=_headers(admin_token), json={"reason": "Need photo"})
        assert r.json()["approval_status"] == "REJECTED"

        # Reopen
        r = client.post(f"/v1/alarm/biannual/{cid}/reopen", headers=_headers(controller_token))
        assert r.json()["approval_status"] == "DRAFT"

        # Re-submit
        r = client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        assert r.json()["approval_status"] == "SUBMITTED"

        # Approve
        r = client.post(f"/v1/alarm/biannual/{cid}/approve",
            headers=_headers(admin_token), json={"notes": "OK now"})
        assert r.json()["approval_status"] == "APPROVED"


# ── Status only counts APPROVED ──────────────────────────────────────────────

class TestBiannualStatusApprovalAware:
    def test_draft_check_shows_no_check(self, client, controller_token, admin_token):
        """A draft check should NOT count as compliant in status."""
        bid = _create_building(client, admin_token, "Bi Status Draft")
        _create_check(client, controller_token, bid)  # stays DRAFT

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "NO_CHECK"

    def test_submitted_check_shows_pending(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Status Submitted")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "PENDING"

    def test_approved_check_shows_compliant(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi Status Approved")
        cid = _create_check(client, controller_token, bid)
        client.post(f"/v1/alarm/biannual/{cid}/submit", headers=_headers(controller_token))
        client.post(f"/v1/alarm/biannual/{cid}/approve",
            headers=_headers(admin_token), json={"notes": "OK"})

        r = client.get("/v1/alarm/biannual/status", headers=_headers(admin_token))
        row = next((r for r in r.json() if r["building_id"] == bid), None)
        assert row["cellular_status"] == "COMPLIANT"

    def test_list_has_approval_status(self, client, controller_token, admin_token):
        bid = _create_building(client, admin_token, "Bi List Status")
        _create_check(client, controller_token, bid)

        r = client.get(f"/v1/alarm/biannual?building_id={bid}", headers=_headers(controller_token))
        for c in r.json():
            assert "approval_status" in c
