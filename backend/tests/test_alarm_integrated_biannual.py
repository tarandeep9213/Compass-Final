"""
TDD: Integrated biannual checks via the regular alarm test flow.

New endpoints under /v1/alarm/tests:
  GET  /{test_id}/biannual-context        — read cellular & camera due/last status
  POST /{test_id}/biannual                — create or update a DRAFT biannual check
  POST /{test_id}/submit-with-biannual    — submit test + DRAFT biannual together
  POST /{test_id}/approve-all             — approve test + SUBMITTED biannual together

Existing /v1/alarm/biannual endpoints continue to work (backward compat).
"""
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def building(client):
    """A throwaway building for these tests."""
    admin = _auth(client, "alarmadmin@alarm.compass.com")
    r = client.post("/v1/alarm/buildings", headers=_h(admin),
        json={"name": "Integrated Biannual Building", "region": "Midwest"})
    bid = r.json()["id"]
    return bid


@pytest.fixture()
def fresh_test(client, building):
    """Create a DRAFT test for the building (one per test for isolation)."""
    tester = _auth(client, "tester@alarm.compass.com")
    # Use unique test_date per fixture call to avoid duplicate-month conflicts
    import uuid as _u
    suffix = _u.uuid4().hex[:6]
    r = client.post("/v1/alarm/tests", headers=_h(tester),
        json={"building_id": building, "test_date": "2026-06-15", "test_month": f"2026-06-{suffix}"})
    assert r.status_code == 201, r.text
    return {"test_id": r.json()["id"], "tester_token": tester, "building_id": building}


# ── Biannual Context ─────────────────────────────────────────────────────────

class TestBiannualContext:
    def test_context_returns_both_slots(self, client, fresh_test):
        r = client.get(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual-context",
            headers=_h(fresh_test["tester_token"]),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["cellular"]["check_type"] == "CELLULAR_BACKUP"
        assert body["camera"]["check_type"] == "CAMERA_BACKUP"

    def test_no_prior_check_means_due(self, client, fresh_test):
        r = client.get(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual-context",
            headers=_h(fresh_test["tester_token"]),
        )
        cellular = r.json()["cellular"]
        # No prior check yet → due
        assert cellular["due"] is True
        assert cellular["last_check"] is None

    def test_unauthorized_role_blocked(self, client, fresh_test):
        # OPERATOR is a cashroom role; alarm endpoints reject it
        op = _auth(client, "operator@compass.com")
        r = client.get(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual-context",
            headers=_h(op),
        )
        assert r.status_code == 403


# ── Add Biannual to Test ─────────────────────────────────────────────────────

class TestAddBiannualToTest:
    def test_add_cellular_creates_draft(self, client, fresh_test):
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-10", "status": "COMPLIANT"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["check_type"] == "CELLULAR_BACKUP"
        assert body["approval_status"] == "DRAFT"
        assert body["next_due_date"] is not None  # auto-calculated
        assert body["status"] == "COMPLIANT"

    def test_add_then_update_reuses_draft(self, client, fresh_test):
        # First add
        r1 = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-10", "status": "COMPLIANT"},
        )
        id1 = r1.json()["id"]
        # Update (same check type) — should reuse, not create another
        r2 = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-12",
                  "status": "NON_COMPLIANT", "notes": "follow-up needed"},
        )
        assert r2.status_code == 201
        assert r2.json()["id"] == id1
        assert r2.json()["status"] == "NON_COMPLIANT"
        assert r2.json()["check_date"] == "2026-06-12"

    def test_camera_includes_days_verified(self, client, fresh_test):
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CAMERA_BACKUP", "check_date": "2026-06-15",
                  "status": "COMPLIANT", "days_verified": 30},
        )
        assert r.status_code == 201
        assert r.json()["days_verified"] == 30

    def test_invalid_check_type_rejected(self, client, fresh_test):
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "BOGUS", "check_date": "2026-06-10"},
        )
        assert r.status_code == 400

    def test_cannot_add_to_submitted_test(self, client, fresh_test):
        # Submit the test first (no biannual)
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        # Now try to add — should be blocked (test is no longer DRAFT)
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-10"},
        )
        assert r.status_code == 400


# ── Submit With Biannual ─────────────────────────────────────────────────────

class TestSubmitWithBiannual:
    def test_submit_without_biannual_is_allowed(self, client, fresh_test):
        # Soft policy: skipping biannual is OK
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "SUBMITTED"

    def test_submit_promotes_draft_biannuals(self, client, fresh_test):
        # Add biannual first
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-10"},
        )
        # Submit
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        assert r.status_code == 200

        # Verify biannual is now SUBMITTED via context
        ctx = client.get(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual-context",
            headers=_h(fresh_test["tester_token"]),
        ).json()
        assert ctx["cellular"]["pending_check"] is not None
        assert ctx["cellular"]["pending_check"]["approval_status"] == "SUBMITTED"


# ── Approve All ──────────────────────────────────────────────────────────────

class TestApproveAll:
    def test_approve_all_with_biannual(self, client, fresh_test):
        approver = _auth(client, "approver@alarm.compass.com")
        # Add + submit with biannual
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual",
            headers=_h(fresh_test["tester_token"]),
            json={"check_type": "CELLULAR_BACKUP", "check_date": "2026-06-10"},
        )
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        # Approve all
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/approve-all",
            headers=_h(approver),
            json={"notes": "Looks good"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "APPROVED"

        # Verify biannual is APPROVED
        ctx = client.get(
            f"/v1/alarm/tests/{fresh_test['test_id']}/biannual-context",
            headers=_h(approver),
        ).json()
        assert ctx["cellular"]["last_check"] is not None
        assert ctx["cellular"]["last_check"]["approval_status"] == "APPROVED"
        assert ctx["cellular"]["pending_check"] is None  # no longer pending

    def test_approve_all_with_no_biannual(self, client, fresh_test):
        approver = _auth(client, "approver@alarm.compass.com")
        # Submit without biannual
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/approve-all",
            headers=_h(approver),
            json={},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"

    def test_approve_all_blocked_for_non_approver(self, client, fresh_test):
        # Submit
        client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/submit-with-biannual",
            headers=_h(fresh_test["tester_token"]),
        )
        # Tester cannot approve
        r = client.post(
            f"/v1/alarm/tests/{fresh_test['test_id']}/approve-all",
            headers=_h(fresh_test["tester_token"]),
            json={},
        )
        assert r.status_code == 403


# ── Backward compatibility: existing /alarm/biannual still works ────────────

class TestBackwardCompat:
    def test_old_biannual_endpoint_still_creates(self, client, building):
        tester = _auth(client, "tester@alarm.compass.com")
        r = client.post("/v1/alarm/biannual", headers=_h(tester), json={
            "building_id": building,
            "check_type": "CELLULAR_BACKUP",
            "check_date": "2026-07-01",
            "status": "COMPLIANT",
        })
        assert r.status_code == 201
        assert r.json()["approval_status"] == "DRAFT"
