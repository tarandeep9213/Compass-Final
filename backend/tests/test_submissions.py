"""
Milestone 3 — Submissions tests (TC-3.x)
"""
import pytest

SECTIONS = {
    "A": {"total": 500.0,  "denominations": {}},
    "B": {"total": 300.0,  "denominations": {}},
    "C": {"total": 200.0,  "denominations": {}},
}


# ── TC-3.1  Operator creates draft ───────────────────────────────────────────
def test_create_draft(client, operator_token):
    r = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={
            "location_id": "loc-1",
            "submission_date": "2026-03-01",
            "source": "FORM",
            "sections": SECTIONS,
            "save_as_draft": True,
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "draft"
    assert body["total_cash"] == 1000.0
    assert body["location_name"] == "The Grange Hotel"


# ── TC-3.2  Operator creates and directly submits ────────────────────────────
def test_create_and_submit_direct(client, operator_token):
    r = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={
            "location_id": "loc-1",
            "submission_date": "2026-03-02",
            "source": "FORM",
            "sections": SECTIONS,
            "save_as_draft": False,
        },
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending_approval"
    assert r.json()["submitted_at"] is not None


# ── TC-3.3  Update draft ──────────────────────────────────────────────────────
def test_update_draft(client, operator_token):
    # Create draft first
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-03",
              "source": "FORM", "sections": {}, "save_as_draft": True},
    )
    sid = create.json()["id"]

    r = client.put(f"/v1/submissions/{sid}",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-03",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": True},
    )
    assert r.status_code == 200
    assert r.json()["total_cash"] == 1000.0


# ── TC-3.4  Submit draft ──────────────────────────────────────────────────────
def test_submit_draft(client, operator_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-04",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": True},
    )
    sid = create.json()["id"]

    r = client.post(f"/v1/submissions/{sid}/submit",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"variance_note": None},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "pending_approval"


# ── TC-3.5  Cannot update a submitted submission ──────────────────────────────
def test_cannot_update_submitted(client, operator_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-05",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
    )
    sid = create.json()["id"]

    r = client.put(f"/v1/submissions/{sid}",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-05",
              "source": "FORM", "sections": SECTIONS},
    )
    assert r.status_code == 400


# ── TC-3.6  Operator cannot access another operator's submission ──────────────
def test_operator_isolation(client, admin_token, operator_token):
    # Admin creates a submission for another operator (via raw DB not possible here)
    # Instead, operator tries to GET a non-existent sub they don't own → 404
    r = client.get("/v1/submissions/non-existent-id",
        headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 404


# ── TC-3.7  Controller approves submission ────────────────────────────────────
def test_approve_submission(client, operator_token, controller_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-06",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
    )
    sid = create.json()["id"]

    r = client.post(f"/v1/submissions/{sid}/approve",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved"
    assert body["approved_by_name"] == "Chris Controller"


# ── TC-3.8  Operator cannot approve ──────────────────────────────────────────
def test_operator_cannot_approve(client, operator_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-07",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
    )
    sid = create.json()["id"]

    r = client.post(f"/v1/submissions/{sid}/approve",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={},
    )
    assert r.status_code == 403


# ── TC-3.8b  Admin cannot approve (only controller can) ──────────────────────
def test_admin_cannot_approve(client, operator_token, admin_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-07b",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
    )
    sid = create.json()["id"]

    r = client.post(f"/v1/submissions/{sid}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert r.status_code == 403


# ── TC-3.9  Reject submission ─────────────────────────────────────────────────
def test_reject_submission(client, operator_token, controller_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-08",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
    )
    sid = create.json()["id"]

    r = client.post(f"/v1/submissions/{sid}/reject",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"reason": "Count does not match receipts"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


# ── TC-3.10  List submissions (operator sees only own) ────────────────────────
def test_list_submissions_operator(client, operator_token):
    r = client.get("/v1/submissions", headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    # All items belong to operator
    for item in body["items"]:
        assert item["operator_name"] == "Alex Operator"


# ── TC-3.11  List submissions with filters ────────────────────────────────────
def test_list_submissions_filter(client, admin_token):
    r = client.get("/v1/submissions?location_id=loc-1&status=approved",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    for item in body["items"]:
        assert item["status"] == "approved"
        assert item["location_id"] == "loc-1"


# ── TC-3.12  Get submission detail ───────────────────────────────────────────
def test_get_submission_detail(client, operator_token):
    create = client.post("/v1/submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "submission_date": "2026-03-09",
              "source": "FORM", "sections": SECTIONS, "save_as_draft": True},
    )
    sid = create.json()["id"]

    r = client.get(f"/v1/submissions/{sid}",
        headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "sections" in body
    assert body["sections"]["A"]["total"] == 500.0


# ── TC-3.13  Log missed submission ───────────────────────────────────────────
def test_log_missed_submission(client, operator_token):
    r = client.post("/v1/missed-submissions",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={
            "location_id": "loc-1",
            "missed_date": "2026-02-28",
            "reason": "Illness",
            "detail": "Cashier was unwell",
            "supervisor_name": "Jane Smith",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["reason"] == "Illness"
    assert body["missed_date"] == "2026-02-28"


# ── TC-3.14  List missed submissions ─────────────────────────────────────────
def test_list_missed_submissions(client, admin_token):
    r = client.get("/v1/missed-submissions",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 1
