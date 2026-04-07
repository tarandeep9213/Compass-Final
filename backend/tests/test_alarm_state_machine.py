"""
State machine violation tests for AlarmTest lifecycle.

Valid transitions:
  DRAFT → SUBMITTED (submit)
  SUBMITTED → APPROVED (approve)
  SUBMITTED → REJECTED (reject)
  REJECTED → DRAFT (reopen)

Every other transition should be blocked with 400.
Also tests double-actions and invalid sequences.
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _building(client, token, name):
    r = client.post("/v1/alarm/buildings", headers=_h(token),
        json={"name": name, "region": "Midwest"})
    return r.json()["id"]


def _test(client, token, bid, date_suffix="01"):
    r = client.post("/v1/alarm/tests", headers=_h(token),
        json={"building_id": bid, "test_date": f"2026-09-{date_suffix}", "test_month": "2026-09"})
    return r.json()["id"]


def _submit(client, token, tid):
    return client.post(f"/v1/alarm/tests/{tid}/submit", headers=_h(token))


def _approve(client, token, tid):
    return client.post(f"/v1/alarm/tests/{tid}/approve", headers=_h(token), json={"notes": "OK"})


def _reject(client, token, tid, reason="Nope"):
    return client.post(f"/v1/alarm/tests/{tid}/reject", headers=_h(token), json={"reason": reason})


def _reopen(client, token, tid):
    return client.post(f"/v1/alarm/tests/{tid}/reopen", headers=_h(token))


# ══════════════════════════════════════════════════════════════════════════════
# DRAFT state: only submit is valid
# ══════════════════════════════════════════════════════════════════════════════

class TestFromDraft:
    """DRAFT → only SUBMITTED is valid."""

    def test_draft_submit_ok(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Draft Submit")
        tid = _test(client, controller_token, bid, "01")
        r = _submit(client, controller_token, tid)
        assert r.status_code == 200
        assert r.json()["status"] == "SUBMITTED"

    def test_draft_approve_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Draft Approve")
        tid = _test(client, controller_token, bid, "02")
        r = _approve(client, admin_token, tid)
        assert r.status_code == 400
        assert "DRAFT" in r.json()["detail"]

    def test_draft_reject_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Draft Reject")
        tid = _test(client, controller_token, bid, "03")
        r = _reject(client, admin_token, tid)
        assert r.status_code == 400
        assert "DRAFT" in r.json()["detail"]

    def test_draft_reopen_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Draft Reopen")
        tid = _test(client, controller_token, bid, "04")
        r = _reopen(client, controller_token, tid)
        assert r.status_code == 400
        assert "DRAFT" in r.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# SUBMITTED state: only approve or reject is valid
# ══════════════════════════════════════════════════════════════════════════════

class TestFromSubmitted:
    """SUBMITTED → APPROVED or REJECTED only."""

    def test_submitted_approve_ok(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Sub Approve")
        tid = _test(client, controller_token, bid, "05")
        _submit(client, controller_token, tid)
        r = _approve(client, admin_token, tid)
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"

    def test_submitted_reject_ok(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Sub Reject")
        tid = _test(client, controller_token, bid, "06")
        _submit(client, controller_token, tid)
        r = _reject(client, admin_token, tid, "Bad zones")
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"

    def test_submitted_submit_again_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Sub Double Submit")
        tid = _test(client, controller_token, bid, "07")
        _submit(client, controller_token, tid)
        r = _submit(client, controller_token, tid)
        assert r.status_code == 400
        assert "SUBMITTED" in r.json()["detail"]

    def test_submitted_reopen_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Sub Reopen")
        tid = _test(client, controller_token, bid, "08")
        _submit(client, controller_token, tid)
        r = _reopen(client, controller_token, tid)
        assert r.status_code == 400
        assert "SUBMITTED" in r.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# APPROVED state: terminal — no further transitions
# ══════════════════════════════════════════════════════════════════════════════

class TestFromApproved:
    """APPROVED is terminal. All actions should fail."""

    def test_approved_submit_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Appr Submit")
        tid = _test(client, controller_token, bid, "09")
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)
        r = _submit(client, controller_token, tid)
        assert r.status_code == 400
        assert "APPROVED" in r.json()["detail"]

    def test_approved_approve_again_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Appr Double")
        tid = _test(client, controller_token, bid, "10")
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)
        r = _approve(client, admin_token, tid)
        assert r.status_code == 400
        assert "APPROVED" in r.json()["detail"]

    def test_approved_reject_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Appr Reject")
        tid = _test(client, controller_token, bid, "11")
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)
        r = _reject(client, admin_token, tid)
        assert r.status_code == 400
        assert "APPROVED" in r.json()["detail"]

    def test_approved_reopen_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Appr Reopen")
        tid = _test(client, controller_token, bid, "12")
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)
        r = _reopen(client, controller_token, tid)
        assert r.status_code == 400
        assert "APPROVED" in r.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# REJECTED state: only reopen is valid
# ══════════════════════════════════════════════════════════════════════════════

class TestFromRejected:
    """REJECTED → only DRAFT (reopen) is valid."""

    def test_rejected_reopen_ok(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Rej Reopen")
        tid = _test(client, controller_token, bid, "13")
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid)
        r = _reopen(client, controller_token, tid)
        assert r.status_code == 200
        assert r.json()["status"] == "DRAFT"

    def test_rejected_submit_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Rej Submit")
        tid = _test(client, controller_token, bid, "14")
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid)
        r = _submit(client, controller_token, tid)
        assert r.status_code == 400
        assert "REJECTED" in r.json()["detail"]

    def test_rejected_approve_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Rej Approve")
        tid = _test(client, controller_token, bid, "15")
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid)
        r = _approve(client, admin_token, tid)
        assert r.status_code == 400
        assert "REJECTED" in r.json()["detail"]

    def test_rejected_reject_again_blocked(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Rej Double")
        tid = _test(client, controller_token, bid, "16")
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid)
        r = _reject(client, admin_token, tid)
        assert r.status_code == 400
        assert "REJECTED" in r.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# Complex multi-step sequences
# ══════════════════════════════════════════════════════════════════════════════

class TestComplexSequences:
    """Multi-step sequences that exercise the full state machine."""

    def test_draft_submit_reject_reopen_submit_approve(self, client, admin_token, controller_token):
        """Happy path with one rejection cycle."""
        bid = _building(client, admin_token, "SM Complex 1")
        tid = _test(client, controller_token, bid, "17")

        assert _submit(client, controller_token, tid).json()["status"] == "SUBMITTED"
        assert _reject(client, admin_token, tid).json()["status"] == "REJECTED"
        assert _reopen(client, controller_token, tid).json()["status"] == "DRAFT"
        assert _submit(client, controller_token, tid).json()["status"] == "SUBMITTED"
        assert _approve(client, admin_token, tid).json()["status"] == "APPROVED"

    def test_triple_rejection_cycle(self, client, admin_token, controller_token):
        """Three reject-reopen-resubmit cycles then approve."""
        bid = _building(client, admin_token, "SM Complex 3x Reject")
        tid = _test(client, controller_token, bid, "18")

        for i in range(3):
            assert _submit(client, controller_token, tid).json()["status"] == "SUBMITTED"
            assert _reject(client, admin_token, tid, f"Rejection #{i+1}").json()["status"] == "REJECTED"
            assert _reopen(client, controller_token, tid).json()["status"] == "DRAFT"

        # Finally approve
        assert _submit(client, controller_token, tid).json()["status"] == "SUBMITTED"
        assert _approve(client, admin_token, tid).json()["status"] == "APPROVED"

        # Verify terminal
        assert _submit(client, controller_token, tid).status_code == 400
        assert _reject(client, admin_token, tid).status_code == 400
        assert _reopen(client, controller_token, tid).status_code == 400

    def test_approve_then_all_blocked(self, client, admin_token, controller_token):
        """Once approved, every single action is blocked."""
        bid = _building(client, admin_token, "SM Complex Terminal")
        tid = _test(client, controller_token, bid, "19")
        _submit(client, controller_token, tid)
        _approve(client, admin_token, tid)

        assert _submit(client, controller_token, tid).status_code == 400
        assert _approve(client, admin_token, tid).status_code == 400
        assert _reject(client, admin_token, tid).status_code == 400
        assert _reopen(client, controller_token, tid).status_code == 400

    def test_reopen_clears_rejection_reason(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Clears Reason")
        tid = _test(client, controller_token, bid, "20")
        _submit(client, controller_token, tid)
        _reject(client, admin_token, tid, "Missing zone 5 test")

        # Verify rejection reason set
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert r.json()["test"]["rejection_reason"] == "Missing zone 5 test"

        # Reopen clears it
        _reopen(client, controller_token, tid)
        r = client.get(f"/v1/alarm/tests/{tid}", headers=_h(controller_token))
        assert r.json()["test"]["rejection_reason"] is None
        assert r.json()["test"]["submitted_at"] is None

    def test_submitted_at_set_on_each_submit(self, client, admin_token, controller_token):
        """Each submit should update submitted_at timestamp."""
        bid = _building(client, admin_token, "SM Timestamp")
        tid = _test(client, controller_token, bid, "21")

        r1 = _submit(client, controller_token, tid)
        ts1 = r1.json()["submitted_at"]
        assert ts1 is not None

        _reject(client, admin_token, tid)
        _reopen(client, controller_token, tid)

        r2 = _submit(client, controller_token, tid)
        ts2 = r2.json()["submitted_at"]
        assert ts2 is not None
        # Second submit should have a new (or same) timestamp
        assert ts2 >= ts1

    def test_approved_by_fields_set_on_approve(self, client, admin_token, controller_token):
        bid = _building(client, admin_token, "SM Approved Fields")
        tid = _test(client, controller_token, bid, "22")
        _submit(client, controller_token, tid)
        r = _approve(client, admin_token, tid)

        body = r.json()
        assert body["approved_by"] is not None
        assert body["approved_by_name"] == "Adam Admin"
        assert body["approved_at"] is not None
