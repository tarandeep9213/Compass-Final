"""
E2E tests for controller Mark as Complete flow — 3 paths:
  Path A (approved):  Operator submitted & approved → controller completes visit
  Path A (pending):   Operator submitted (pending) → controller approves inline & completes
  Path B (no sub):    No operator submission → controller fills form (auto-approved) & completes
  Path B (rejected):  Operator submission rejected → controller fills new form & completes
"""
import pytest


# ── Helpers ──────────────────────────────────────────────────────────────────

def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _schedule_visit(client, token: str, location_id: str, date: str) -> str:
    """Schedule a controller visit and return its ID."""
    r = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "location_id": location_id,
            "date": date,
            "scheduled_time": "09:00",
            "dow_warning_acknowledged": True,
        },
    )
    assert r.status_code == 201, f"Schedule failed: {r.text}"
    return r.json()["id"]


def _operator_submit(client, token: str, location_id: str, date: str) -> str:
    """Operator creates and submits a cash count form. Returns submission ID."""
    r = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "location_id": location_id,
            "submission_date": date,
            "source": "FORM",
            "sections": {
                "A": {"total": 5000, "ones": 100, "fives": 200, "tens": 150, "twenties": 50, "fifties": 10, "hundreds": 5},
                "B": {"total": 200, "dollar": 50, "quarters": 100, "dimes": 50},
            },
            "variance_note": None,
            "save_as_draft": False,
        },
    )
    assert r.status_code == 201, f"Operator submit failed: {r.text}"
    body = r.json()
    assert body["status"] == "pending_approval"
    return body["id"]


def _complete_visit(client, token: str, visit_id: str, observed_total: float = 5200.0) -> dict:
    """Complete a controller visit. Returns response body."""
    r = client.patch(f"/v1/verifications/controller/{visit_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "observed_total": observed_total,
            "signature_data": "data:image/png;base64,testSignature123",
            "notes": "E2E test completion",
            "visit_section_reviews": {
                "A": {"decision": "accept", "note": ""},
                "B": {"decision": "accept", "note": ""},
            },
        },
    )
    assert r.status_code == 200, f"Complete failed: {r.text}"
    return r.json()


# ── Path A: Operator submitted & approved → controller completes ─────────────

class TestPathA_Approved:
    """Operator submits, controller approves submission, then completes visit."""

    def test_full_flow(self, client):
        op_token = _auth(client, "operator@compass.com")
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Schedule visit
        visit_id = _schedule_visit(client, ctrl_token, "loc-1", "2026-06-01")

        # 2. Operator submits
        sub_id = _operator_submit(client, op_token, "loc-1", "2026-06-01")

        # 3. Controller approves submission
        r = client.post(f"/v1/submissions/{sub_id}/approve",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={"notes": "Looks good"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        # 4. Controller completes visit
        body = _complete_visit(client, ctrl_token, visit_id)
        assert body["status"] == "completed"
        assert body["observed_total"] == 5200.0
        assert body["visit_section_reviews"]["A"]["decision"] == "accept"


# ── Path A: Operator submitted (pending) → controller approves inline ────────

class TestPathA_Pending:
    """Operator submits (pending approval), controller can still complete.
    In the UI, the controller would approve inline via OpReadonly before completing."""

    def test_controller_approves_pending_then_completes(self, client):
        op_token = _auth(client, "operator@compass.com")
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Schedule visit
        visit_id = _schedule_visit(client, ctrl_token, "loc-1", "2026-06-08")

        # 2. Operator submits (stays pending)
        sub_id = _operator_submit(client, op_token, "loc-1", "2026-06-08")

        # 3. Verify submission is pending
        r = client.get(f"/v1/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {ctrl_token}"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "pending_approval"

        # 4. Controller approves inline (as OpReadonly would do in completionMode)
        r = client.post(f"/v1/submissions/{sub_id}/approve",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={"notes": "Approved during visit completion"},
        )
        assert r.status_code == 200

        # 5. Controller completes visit
        body = _complete_visit(client, ctrl_token, visit_id)
        assert body["status"] == "completed"


# ── Path B: No operator submission → controller fills form ───────────────────

class TestPathB_NoSubmission:
    """No operator submission exists. Controller fills the form themselves.
    The submission is auto-approved with submitted_by_role=CONTROLLER."""

    def test_controller_creates_submission_auto_approved(self, client):
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Controller creates submission (no operator submitted)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-06-15",
                "source": "FORM",
                "sections": {
                    "A": {"total": 4800},
                    "B": {"total": 150},
                },
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        assert r.status_code == 201, f"Controller submit failed: {r.text}"
        body = r.json()

        # Verify auto-approved
        assert body["status"] == "approved"
        assert body["submitted_by_role"] == "CONTROLLER"
        assert body["approved_by_name"] == "Chris Controller"
        assert body["approved_at"] is not None

    def test_full_flow_with_visit_completion(self, client):
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Schedule visit
        visit_id = _schedule_visit(client, ctrl_token, "loc-2", "2026-06-15")

        # 2. Controller fills form (no operator submission)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={
                "location_id": "loc-2",
                "submission_date": "2026-06-15",
                "source": "FORM",
                "sections": {"A": {"total": 4800}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        assert r.status_code == 201
        sub_total = r.json()["total_cash"]

        # 3. Controller completes visit using their own form total
        body = _complete_visit(client, ctrl_token, visit_id, observed_total=sub_total)
        assert body["status"] == "completed"


# ── Path B: Operator submission rejected → controller fills new form ─────────

class TestPathB_Rejected:
    """Operator submitted but got rejected. Controller fills a fresh form
    which replaces the rejected submission."""

    def test_controller_replaces_rejected_submission(self, client):
        op_token = _auth(client, "operator@compass.com")
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Operator submits
        sub_id = _operator_submit(client, op_token, "loc-1", "2026-06-22")

        # 2. Controller rejects it
        r = client.post(f"/v1/submissions/{sub_id}/reject",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={"reason": "Incorrect coin count in Section B"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

        # 3. Controller fills a new form (replaces rejected one)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-06-22",
                "source": "FORM",
                "sections": {"A": {"total": 5100}, "B": {"total": 250}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        assert r.status_code == 201, f"Controller replace failed: {r.text}"
        body = r.json()
        assert body["status"] == "approved"
        assert body["submitted_by_role"] == "CONTROLLER"

    def test_full_flow_rejected_then_complete(self, client):
        op_token = _auth(client, "operator@compass.com")
        ctrl_token = _auth(client, "controller@compass.com")

        # 1. Schedule visit
        visit_id = _schedule_visit(client, ctrl_token, "loc-2", "2026-06-22")

        # 2. Operator submits
        sub_id = _operator_submit(client, op_token, "loc-2", "2026-06-22")

        # 3. Controller rejects
        client.post(f"/v1/submissions/{sub_id}/reject",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={"reason": "Wrong amounts"},
        )

        # 4. Controller fills new form
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={
                "location_id": "loc-2",
                "submission_date": "2026-06-22",
                "source": "FORM",
                "sections": {"A": {"total": 5300}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        assert r.status_code == 201
        sub_total = r.json()["total_cash"]

        # 5. Controller completes visit
        body = _complete_visit(client, ctrl_token, visit_id, observed_total=sub_total)
        assert body["status"] == "completed"


# ── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    """Guard rails and edge cases."""

    def test_operator_cannot_submit_as_controller(self, client):
        """Operator role should default to OPERATOR even if they send CONTROLLER."""
        op_token = _auth(client, "operator@compass.com")
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {op_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-07-01",
                "source": "FORM",
                "sections": {"A": {"total": 100}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        # Operator is not CONTROLLER role, so is_controller_submission is False
        # but submitted_by_role field is passed through — the key check is the role gate
        assert r.status_code == 201
        body = r.json()
        # Status should be pending (not auto-approved) since user is OPERATOR role
        assert body["status"] == "pending_approval"

    def test_controller_cannot_create_duplicate_non_rejected(self, client):
        """Controller cannot replace an approved or pending submission."""
        ctrl_token = _auth(client, "controller@compass.com")
        op_token = _auth(client, "operator@compass.com")

        # Operator submits (pending)
        _operator_submit(client, op_token, "loc-1", "2026-07-08")

        # Controller tries to submit for same location+date (should fail - not rejected)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-07-08",
                "source": "FORM",
                "sections": {"A": {"total": 100}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "CONTROLLER",
            },
        )
        assert r.status_code == 409  # Conflict — submission already exists

    def test_submitted_by_role_in_list_response(self, client):
        """Verify submitted_by_role appears in submission list responses."""
        ctrl_token = _auth(client, "controller@compass.com")
        r = client.get("/v1/submissions?location_id=loc-2",
            headers={"Authorization": f"Bearer {ctrl_token}"},
        )
        assert r.status_code == 200
        items = r.json()["items"]
        for item in items:
            assert "submitted_by_role" in item
            assert item["submitted_by_role"] in ("OPERATOR", "CONTROLLER", "DGM")


# ── DGM Path B: No operator submission → DGM fills form ─────────────────────

class TestDGM_PathB_NoSubmission:
    """DGM fills the form themselves when operator hasn't submitted."""

    def test_dgm_creates_submission_auto_approved(self, client):
        dgm_token = _auth(client, "dgm@compass.com")

        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-08-01",
                "source": "FORM",
                "sections": {"A": {"total": 4500}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "DGM",
            },
        )
        assert r.status_code == 201, f"DGM submit failed: {r.text}"
        body = r.json()
        assert body["status"] == "approved"
        assert body["submitted_by_role"] == "DGM"
        assert body["approved_by_name"] == "Diana DGM"

    def test_dgm_full_flow_with_visit_completion(self, client):
        dgm_token = _auth(client, "dgm@compass.com")

        # 1. Schedule DGM visit
        r = client.post("/v1/verifications/dgm",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={"location_id": "loc-1", "date": "2026-08-15", "notes": "DGM E2E test"},
        )
        assert r.status_code == 201
        visit_id = r.json()["id"]

        # 2. DGM fills form (no operator submission)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-08-15",
                "source": "FORM",
                "sections": {"A": {"total": 4800}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "DGM",
            },
        )
        assert r.status_code == 201
        sub_total = r.json()["total_cash"]

        # 3. DGM completes visit
        r = client.patch(f"/v1/verifications/dgm/{visit_id}/complete",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "observed_total": sub_total,
                "signature_data": "data:image/png;base64,dgmSig123",
                "notes": "DGM E2E completion",
            },
        )
        assert r.status_code == 200
        assert r.json()["status"] == "completed"


# ── DGM Path B: Rejected → DGM fills new form ───────────────────────────────

class TestDGM_PathB_Rejected:
    """Operator submitted but got rejected. DGM fills a fresh form."""

    def test_dgm_replaces_rejected_submission(self, client):
        op_token = _auth(client, "operator@compass.com")
        ctrl_token = _auth(client, "controller@compass.com")
        dgm_token = _auth(client, "dgm@compass.com")

        # 1. Operator submits
        sub_id = _operator_submit(client, op_token, "loc-1", "2026-08-22")

        # 2. Controller rejects it
        r = client.post(f"/v1/submissions/{sub_id}/reject",
            headers={"Authorization": f"Bearer {ctrl_token}"},
            json={"reason": "Incorrect amounts"},
        )
        assert r.status_code == 200

        # 3. DGM fills a new form (replaces rejected one)
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "location_id": "loc-1",
                "submission_date": "2026-08-22",
                "source": "FORM",
                "sections": {"A": {"total": 5000}},
                "variance_note": None,
                "save_as_draft": False,
                "submitted_by_role": "DGM",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "approved"
        assert body["submitted_by_role"] == "DGM"
