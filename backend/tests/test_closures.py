"""Tests for closure_records (BUGS_2026-04-20 #2)."""


# Use a known Monday (2026-04-20 is Monday) and Saturday (2026-04-25).
MONDAY = "2026-04-20"
TUESDAY = "2026-04-21"
SATURDAY = "2026-04-25"
SUNDAY = "2026-04-26"


def _auth(token): return {"Authorization": f"Bearer {token}"}


def test_create_closure_happy_path(client, operator_token):
    """Operator reports a holiday for their assigned location → 201."""
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": MONDAY, "reason": "HOLIDAY", "notes": ""},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["location_id"] == "loc-1"
    assert body["closure_date"] == MONDAY
    assert body["reason"] == "HOLIDAY"
    assert body["reported_by_id"]
    assert body["reported_by_name"]


def test_create_closure_other_requires_notes(client, operator_token):
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": TUESDAY, "reason": "OTHER", "notes": ""},
    )
    assert r.status_code == 422
    # Pydantic 2 wraps the field validator's error — look for our message.
    assert "notes are required" in r.text


def test_create_closure_other_accepts_with_notes(client, operator_token):
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": TUESDAY, "reason": "OTHER",
              "notes": "Power outage due to storm"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["notes"] == "Power outage due to storm"


def test_create_closure_rejects_saturday(client, operator_token):
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": SATURDAY, "reason": "WEATHER", "notes": ""},
    )
    assert r.status_code == 422
    assert "weekday" in r.text or "Saturday" in r.text


def test_create_closure_rejects_sunday(client, operator_token):
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": SUNDAY, "reason": "HOLIDAY", "notes": ""},
    )
    assert r.status_code == 422


def test_duplicate_closure_409(client, operator_token):
    d = "2026-04-22"  # Wednesday
    r1 = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": d, "reason": "HOLIDAY", "notes": ""},
    )
    assert r1.status_code == 201, r1.text
    r2 = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": d, "reason": "WEATHER", "notes": ""},
    )
    assert r2.status_code == 409


def test_operator_cannot_close_unassigned_location(client, operator_token):
    """Operator is assigned to loc-1; reporting for loc-2 should 403."""
    r = client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-2", "closure_date": "2026-04-23", "reason": "HOLIDAY", "notes": ""},
    )
    assert r.status_code == 403


def test_list_closures_filters(client, operator_token):
    # Seed one for loc-1 Thursday + one for operator's location
    client.post(
        "/v1/closures",
        headers=_auth(operator_token),
        json={"location_id": "loc-1", "closure_date": "2026-04-23", "reason": "HOLIDAY", "notes": ""},
    )
    # List without filter — operator sees own location's closures only
    r = client.get("/v1/closures", headers=_auth(operator_token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert all(c["location_id"] == "loc-1" for c in body["items"])

    # Date filter narrows the window
    r2 = client.get(
        "/v1/closures?date_from=2026-04-23&date_to=2026-04-23",
        headers=_auth(operator_token),
    )
    assert r2.status_code == 200
    assert all(c["closure_date"] == "2026-04-23" for c in r2.json()["items"])


def test_controller_can_report_for_any_location(client, controller_token):
    """Controllers (full-portfolio role) can report closures broadly."""
    r = client.post(
        "/v1/closures",
        headers=_auth(controller_token),
        json={"location_id": "loc-2", "closure_date": "2026-04-24", "reason": "WEATHER", "notes": ""},
    )
    assert r.status_code == 201, r.text
