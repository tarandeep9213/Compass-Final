"""
Milestone 4 — Verifications tests (TC-4.x)
"""
import pytest


@pytest.fixture(scope="session")
def dgm_token(client):
    r = client.post("/v1/auth/login", json={"email": "dgm@compass.com", "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


# ── TC-4.1  DOW check — no warning (first visit) ─────────────────────────────
def test_dow_check_no_warning(client, controller_token):
    r = client.get(
        "/v1/verifications/controller/check-dow?location_id=loc-1&date=2026-03-10",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "warning" in body
    assert body["day_name"] == "Tuesday"


# ── TC-4.2  Schedule controller visit ────────────────────────────────────────
def test_schedule_controller_visit(client, controller_token):
    r = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={
            "location_id": "loc-1",
            "date": "2026-03-10",
            "scheduled_time": "09:00",
            "dow_warning_acknowledged": False,
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "scheduled"
    assert body["verification_type"] == "CONTROLLER"
    assert body["day_name"] == "Tuesday"


# ── TC-4.3  Operator cannot schedule controller visit ────────────────────────
def test_operator_cannot_schedule_controller(client, operator_token):
    r = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"location_id": "loc-1", "date": "2026-03-11",
              "scheduled_time": "09:00", "dow_warning_acknowledged": False},
    )
    assert r.status_code == 403


# ── TC-4.4  Complete controller visit ────────────────────────────────────────
def test_complete_controller_visit(client, controller_token):
    # Schedule first
    create = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"location_id": "loc-1", "date": "2026-03-12",
              "scheduled_time": "11:00", "dow_warning_acknowledged": False},
    )
    vid = create.json()["id"]

    r = client.patch(f"/v1/verifications/controller/{vid}/complete",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"observed_total": 2500.00, "signature_data": "data:image/png;base64,abc", "notes": "All good"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "completed"
    assert body["observed_total"] == 2500.00


# ── TC-4.5  Cannot complete already completed visit ───────────────────────────
def test_cannot_complete_twice(client, controller_token):
    create = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"location_id": "loc-1", "date": "2026-03-13",
              "scheduled_time": "09:00", "dow_warning_acknowledged": False},
    )
    vid = create.json()["id"]
    client.patch(f"/v1/verifications/controller/{vid}/complete",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"observed_total": 1000.0, "signature_data": "abc"},
    )
    r = client.patch(f"/v1/verifications/controller/{vid}/complete",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"observed_total": 999.0, "signature_data": "abc"},
    )
    assert r.status_code == 400


# ── TC-4.6  Mark controller visit as missed ──────────────────────────────────
def test_miss_controller_visit(client, controller_token):
    create = client.post("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"location_id": "loc-2", "date": "2026-03-14",
              "scheduled_time": "13:00", "dow_warning_acknowledged": False},
    )
    vid = create.json()["id"]

    r = client.patch(f"/v1/verifications/controller/{vid}/miss",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"missed_reason": "Illness", "notes": "Unwell on the day"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "missed"
    assert r.json()["missed_reason"] == "Illness"


# ── TC-4.7  List controller verifications ────────────────────────────────────
def test_list_controller_verifications(client, controller_token):
    r = client.get("/v1/verifications/controller",
        headers={"Authorization": f"Bearer {controller_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 3
    for item in body["items"]:
        assert item["verification_type"] == "CONTROLLER"


# ── TC-4.8  DOW warning triggers after repeated same-day visits ───────────────
def test_dow_warning_triggers(client, controller_token):
    # Schedule two visits on same day of week (Monday = 2026-03-09, 2026-03-16)
    for d in ["2026-03-09", "2026-03-16"]:
        client.post("/v1/verifications/controller",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={"location_id": "loc-3", "date": d,
                  "scheduled_time": "09:00", "dow_warning_acknowledged": False},
        )

    # Now check DOW for the same weekday
    r = client.get(
        "/v1/verifications/controller/check-dow?location_id=loc-3&date=2026-03-23",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["warning"] is True
    assert body["match_count"] >= 2


# ── TC-4.9  Schedule DGM visit ───────────────────────────────────────────────
def test_schedule_dgm_visit(client, dgm_token):
    r = client.post("/v1/verifications/dgm",
        headers={"Authorization": f"Bearer {dgm_token}"},
        json={"location_id": "loc-1", "date": "2026-03-15", "notes": "Monthly check"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "scheduled"
    assert body["verification_type"] == "DGM"
    assert body["month_year"] == "2026-03"


# ── TC-4.10  Controller cannot schedule DGM visit ────────────────────────────
def test_controller_cannot_schedule_dgm(client, controller_token):
    r = client.post("/v1/verifications/dgm",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"location_id": "loc-1", "date": "2026-03-16"},
    )
    assert r.status_code == 403


# ── TC-4.11  Complete DGM visit ──────────────────────────────────────────────
def test_complete_dgm_visit(client, dgm_token):
    create = client.post("/v1/verifications/dgm",
        headers={"Authorization": f"Bearer {dgm_token}"},
        json={"location_id": "loc-2", "date": "2026-03-20"},
    )
    vid = create.json()["id"]

    r = client.patch(f"/v1/verifications/dgm/{vid}/complete",
        headers={"Authorization": f"Bearer {dgm_token}"},
        json={"observed_total": 3200.00, "signature_data": "data:image/png;base64,xyz", "notes": "Visit complete"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert r.json()["observed_total"] == 3200.00


# ── TC-4.12  List DGM verifications filtered by month ────────────────────────
def test_list_dgm_verifications_by_month(client, dgm_token):
    r = client.get("/v1/verifications/dgm?month_year=2026-03",
        headers={"Authorization": f"Bearer {dgm_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert item["month_year"] == "2026-03"
