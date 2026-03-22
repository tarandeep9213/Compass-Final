"""
Milestone 5 — Compliance, Reports, Audit Trail (TC-5.x)
"""
import pytest

SECTIONS = {"A": {"total": 800.0}, "B": {"total": 400.0}}


@pytest.fixture(scope="module")
def auditor_token(client):
    r = client.post("/v1/auth/login", json={"email": "auditor@compass.com", "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


# ── Seed a few submissions so reports have data ───────────────────────────────
@pytest.fixture(scope="module", autouse=True)
def seed_submissions(client, operator_token, controller_token):
    dates = ["2026-02-01", "2026-02-10", "2026-02-20"]
    sids = []
    for d in dates:
        r = client.post("/v1/submissions",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"location_id": "loc-1", "submission_date": d,
                  "source": "FORM", "sections": SECTIONS, "save_as_draft": False},
        )
        sids.append(r.json()["id"])
    # Approve first two
    for sid in sids[:2]:
        client.post(f"/v1/submissions/{sid}/approve",
            headers={"Authorization": f"Bearer {controller_token}"}, json={})
    # Reject last one
    client.post(f"/v1/submissions/{sids[-1]}/reject",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"reason": "Mismatch"})


# ═══════════════════════════════════════════
# COMPLIANCE DASHBOARD
# ═══════════════════════════════════════════

# ── TC-5.1  Compliance dashboard returns structure ───────────────────────────
def test_compliance_dashboard_structure(client, admin_token):
    r = client.get("/v1/compliance/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "summary" in body
    assert "locations" in body
    s = body["summary"]
    assert "overall_compliance_pct" in s
    assert "submitted_today" in s
    assert "total_locations" in s


# ── TC-5.2  Compliance dashboard shows correct location count ─────────────────
def test_compliance_dashboard_location_count(client, admin_token):
    r = client.get("/v1/compliance/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"})
    body = r.json()
    assert len(body["locations"]) >= 5


# ── TC-5.3  Operator only sees their locations in dashboard ──────────────────
def test_compliance_dashboard_operator_filtered(client, operator_token):
    r = client.get("/v1/compliance/dashboard",
        headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 200
    body = r.json()
    assert all(loc["id"] == "loc-1" for loc in body["locations"])


# ── TC-5.4  Sort by name ─────────────────────────────────────────────────────
def test_compliance_dashboard_sort_name(client, admin_token):
    r = client.get("/v1/compliance/dashboard?sort=name",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    names = [l["name"] for l in r.json()["locations"]]
    assert names == sorted(names)


# ═══════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════

# ── TC-5.5  Report summary over date range ───────────────────────────────────
def test_report_summary(client, admin_token):
    r = client.get("/v1/reports/summary?date_from=2026-02-01&date_to=2026-02-28",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_submissions"] >= 3
    assert body["approved"] >= 2
    assert body["rejected"] >= 1
    assert "approval_rate_pct" in body


# ── TC-5.6  Location report ──────────────────────────────────────────────────
def test_location_report(client, admin_token):
    r = client.get("/v1/reports/locations?date_from=2026-02-01&date_to=2026-02-28",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 1
    # loc-1 should be there
    ids = [i["location_id"] for i in body["items"]]
    assert "loc-1" in ids


# ── TC-5.7  Exception report ─────────────────────────────────────────────────
def test_exception_report(client, admin_token):
    r = client.get("/v1/reports/exceptions?date_from=2026-01-01&date_to=2026-12-31",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    for item in body["items"]:
        assert item["variance_exception"] if "variance_exception" in item else True


# ── TC-5.8  Section trends ───────────────────────────────────────────────────
def test_section_trends(client, admin_token):
    r = client.get("/v1/reports/section-trends?section=A&granularity=monthly&periods=6",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["section"] == "A"
    assert "data" in body
    assert "summary" in body
    assert "latest_value" in body["summary"]
    assert "peak" in body["summary"]


# ── TC-5.9  CSV export returns file ─────────────────────────────────────────
def test_export_csv(client, admin_token):
    r = client.get("/v1/reports/export?date_from=2026-02-01&date_to=2026-02-28",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    lines = r.text.strip().split("\n")
    assert lines[0].startswith("Date,Location")
    assert len(lines) >= 4  # header + 3 rows


# ═══════════════════════════════════════════
# AUDIT TRAIL
# ═══════════════════════════════════════════

# ── TC-5.10  Audit trail accessible by admin ─────────────────────────────────
def test_audit_list_admin(client, admin_token):
    r = client.get("/v1/audit", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 1


# ── TC-5.11  Audit trail accessible by auditor ───────────────────────────────
def test_audit_list_auditor(client, auditor_token):
    r = client.get("/v1/audit", headers={"Authorization": f"Bearer {auditor_token}"})
    assert r.status_code == 200


# ── TC-5.12  Operator cannot access audit trail ──────────────────────────────
def test_audit_forbidden_operator(client, operator_token):
    r = client.get("/v1/audit", headers={"Authorization": f"Bearer {operator_token}"})
    assert r.status_code == 403


# ── TC-5.13  Audit events contain expected event types ───────────────────────
def test_audit_event_types(client, admin_token):
    r = client.get("/v1/audit", headers={"Authorization": f"Bearer {admin_token}"})
    event_types = {e["event_type"] for e in r.json()["items"]}
    # Should have submission and user events from seed_submissions fixture
    assert len(event_types) >= 1


# ── TC-5.14  Audit filter by event_type ──────────────────────────────────────
def test_audit_filter_event_type(client, admin_token):
    r = client.get("/v1/audit?event_type=SUBMISSION_APPROVED",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["event_type"] == "SUBMISSION_APPROVED"


# ── TC-5.15  Audit filter options ────────────────────────────────────────────
def test_audit_filter_options(client, admin_token):
    r = client.get("/v1/audit/filter-options",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "actors" in body
    assert "locations" in body
