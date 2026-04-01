"""
Cash Reasonableness Test — TDD Test Suite
==========================================

Phase 2 feature: quarterly compliance control that checks whether each
cash room holds appropriate funds relative to operational usage.

Test Approach:
- Tests are written FIRST (Red), then implementation follows (Green)
- Each test documents: Purpose, Setup, Action, Assertions
- Tests grouped by phase: Model → Schema → Business Logic → API Endpoints

Naming: TC-RT-{phase}.{number} for traceability to the TDD plan in
codebase/implementation-plans/2026-03-27_reasonableness-backend-tdd.md
"""
import uuid
import math
from datetime import date, datetime, timezone

import pytest
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Helpers — reusable across all test phases
# ---------------------------------------------------------------------------

SAMPLE_LOC_REPORT = {
    "loc_id": "loc-1",
    "loc_label": "The Grange Hotel",
    "total": 3452.0,
    "expected_fund": 4315.0,
    "actual_fund": 3800.0,
    "over": -515.0,
    "cushion": -5000.0,
    "net": -5515.0,
    "status": "Reasonable",
    "conclusion": "Funds within acceptable range for Q2 operations.",
    "required_actions": "no",
    "action_details": "",
}

SAMPLE_LOC_REPORT_OVERFUNDED = {
    **SAMPLE_LOC_REPORT,
    "loc_id": "loc-2",
    "loc_label": "Compass HQ Canteen",
    "total": 6000.0,
    "expected_fund": 7500.0,
    "actual_fund": 14000.0,
    "over": 6500.0,
    "cushion": -5000.0,
    "net": 1500.0,
    "status": "Overfunded",
    "conclusion": "Excess funds detected; review replenishment schedule.",
    "required_actions": "yes",
    "action_details": "Reduce next replenishment by $1,500.",
}


# ===========================================================================
# PHASE 1 — Model Tests (TC-RT-1.x)
# ===========================================================================
# These tests validate that the ReasonablenessReport ORM model correctly
# persists to and retrieves from the database, including enum constraints
# and JSON column round-trips.


class TestReasonablenessModel:
    """
    TC-RT-1.1: ReasonablenessReport model can be created and queried
    ----------------------------------------------------------------
    Purpose:  Verify the ORM model round-trips through SQLite correctly.
    Setup:    Import the model, create an instance with all required fields.
    Action:   Add to session, commit, then query back by primary key.
    Expect:   All fields match what was inserted; timestamps are populated.
    """

    def test_create_and_query_report(self, db_session: Session):
        from app.models.reasonableness import ReasonablenessReport, ReasonablenessStatus

        report_id = str(uuid.uuid4())
        report = ReasonablenessReport(
            id=report_id,
            group_key="5082",
            cost_center="5082",
            location_labels="APPLETON / WAUSAU",
            from_date=date(2026, 1, 1),
            to_date=date(2026, 2, 28),
            factor=1.50,
            preparer="Chris Controller",
            scope="Daily Cashroom Reconciliations for P4 and P5, FY2026",
            status=ReasonablenessStatus.REASONABLE,
            location_reports=[SAMPLE_LOC_REPORT],
            saved_by="user-123",
        )

        db_session.add(report)
        db_session.commit()

        # Query back
        fetched = db_session.get(ReasonablenessReport, report_id)
        assert fetched is not None, "Report should be retrievable by primary key"
        assert fetched.group_key == "5082"
        assert fetched.cost_center == "5082"
        assert fetched.location_labels == "APPLETON / WAUSAU"
        assert fetched.from_date == date(2026, 1, 1)
        assert fetched.to_date == date(2026, 2, 28)
        assert fetched.factor == 1.50
        assert fetched.preparer == "Chris Controller"
        assert fetched.scope == "Daily Cashroom Reconciliations for P4 and P5, FY2026"
        assert fetched.status == ReasonablenessStatus.REASONABLE
        assert fetched.saved_by == "user-123"
        assert fetched.created_at is not None, "created_at should auto-populate"
        assert fetched.updated_at is not None, "updated_at should auto-populate"

        # Cleanup
        db_session.delete(fetched)
        db_session.commit()

    """
    TC-RT-1.2: Status enum constrains to Reasonable | Overfunded
    -------------------------------------------------------------
    Purpose:  Verify both valid enum values are accepted.
    Setup:    Create two reports — one Reasonable, one Overfunded.
    Action:   Commit both, then verify their status values.
    Expect:   Each has the correct enum value.
    """

    def test_status_enum_values(self, db_session: Session):
        from app.models.reasonableness import ReasonablenessReport, ReasonablenessStatus

        # Verify both enum values exist and are correct strings
        assert ReasonablenessStatus.REASONABLE.value == "Reasonable"
        assert ReasonablenessStatus.OVERFUNDED.value == "Overfunded"

        # Create a report with each status
        for status in [ReasonablenessStatus.REASONABLE, ReasonablenessStatus.OVERFUNDED]:
            rid = str(uuid.uuid4())
            report = ReasonablenessReport(
                id=rid,
                group_key="5104",
                cost_center="5104",
                location_labels="CENTRAL IL",
                from_date=date(2026, 1, 1),
                to_date=date(2026, 3, 31),
                factor=1.25,
                preparer="Chris Controller",
                status=status,
                location_reports=[],
                saved_by="user-123",
            )
            db_session.add(report)
            db_session.commit()

            fetched = db_session.get(ReasonablenessReport, rid)
            assert fetched.status == status, f"Expected {status}, got {fetched.status}"

            db_session.delete(fetched)
            db_session.commit()

    """
    TC-RT-1.3: location_reports JSON stores and retrieves list of dicts
    -------------------------------------------------------------------
    Purpose:  Verify the JSON column correctly stores an array of
              RtLocReport-shaped dictionaries and retrieves them intact.
    Setup:    Create a report with 2 location reports (one Reasonable,
              one Overfunded) in the location_reports JSON field.
    Action:   Commit, then re-query and inspect the JSON.
    Expect:   Both dicts round-trip with all keys/values preserved.
    """

    def test_location_reports_json_roundtrip(self, db_session: Session):
        from app.models.reasonableness import ReasonablenessReport, ReasonablenessStatus

        rid = str(uuid.uuid4())
        loc_reports = [SAMPLE_LOC_REPORT, SAMPLE_LOC_REPORT_OVERFUNDED]

        report = ReasonablenessReport(
            id=rid,
            group_key="5082",
            cost_center="5082",
            location_labels="APPLETON / WAUSAU",
            from_date=date(2026, 1, 1),
            to_date=date(2026, 2, 28),
            factor=1.50,
            preparer="Chris Controller",
            status=ReasonablenessStatus.OVERFUNDED,
            location_reports=loc_reports,
            saved_by="user-123",
        )
        db_session.add(report)
        db_session.commit()

        # Expire to force re-read from DB
        db_session.expire(report)
        fetched = db_session.get(ReasonablenessReport, rid)

        assert isinstance(fetched.location_reports, list), "Should be a list"
        assert len(fetched.location_reports) == 2, "Should have 2 location reports"

        # Verify first report (Reasonable)
        lr1 = fetched.location_reports[0]
        assert lr1["loc_id"] == "loc-1"
        assert lr1["total"] == 3452.0
        assert lr1["status"] == "Reasonable"
        assert lr1["conclusion"] == "Funds within acceptable range for Q2 operations."

        # Verify second report (Overfunded)
        lr2 = fetched.location_reports[1]
        assert lr2["loc_id"] == "loc-2"
        assert lr2["net"] == 1500.0
        assert lr2["status"] == "Overfunded"
        assert lr2["required_actions"] == "yes"
        assert lr2["action_details"] == "Reduce next replenishment by $1,500."

        # Cleanup
        db_session.delete(fetched)
        db_session.commit()

    """
    TC-RT-1.4: Location.group column exists and is queryable
    ---------------------------------------------------------
    Purpose:  Verify the new 'group' column on the Location model
              can be set, persisted, and used in filter queries.
    Setup:    Update existing seed locations to have group values,
              then query locations by group.
    Action:   Set group on loc-1 and loc-2 to same value,
              query WHERE group == value.
    Expect:   Both locations returned; loc-3 (different group) excluded.
    """

    def test_location_group_column(self, db_session: Session):
        from app.models.location import Location

        # Set group values on seed locations
        loc1 = db_session.get(Location, "loc-1")
        loc2 = db_session.get(Location, "loc-2")
        loc3 = db_session.get(Location, "loc-3")

        assert loc1 is not None, "Seed location loc-1 should exist"
        assert loc2 is not None, "Seed location loc-2 should exist"

        loc1.group = "GRP-A"
        loc2.group = "GRP-A"
        loc3.group = "GRP-B"
        db_session.commit()

        # Query by group
        grp_a = db_session.query(Location).filter(Location.group == "GRP-A").all()
        assert len(grp_a) == 2, "Should find 2 locations in GRP-A"
        grp_a_ids = {l.id for l in grp_a}
        assert "loc-1" in grp_a_ids
        assert "loc-2" in grp_a_ids

        # Verify different group is excluded
        grp_b = db_session.query(Location).filter(Location.group == "GRP-B").all()
        assert len(grp_b) == 1
        assert grp_b[0].id == "loc-3"

        # Cleanup — reset group values to avoid side effects
        loc1.group = None
        loc2.group = None
        loc3.group = None
        db_session.commit()


# ===========================================================================
# Fixture: db_session for model tests (function-scoped, rolls back)
# ===========================================================================

@pytest.fixture()
def db_session():
    """
    Provides a fresh SQLAlchemy session for each test function.
    Uses the same test database as conftest.py's setup_db.
    Each test gets its own session to avoid cross-test contamination.
    """
    from tests.conftest import TestingSessionLocal
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ===========================================================================
# PHASE 2 — Schema Tests (TC-RT-2.x)
# ===========================================================================
# These tests validate that Pydantic schemas correctly parse, validate,
# and serialize data for the reasonableness API endpoints.


class TestReasonablenessSchemas:
    """
    TC-RT-2.1: GenerateRequest accepts valid input
    -----------------------------------------------
    Purpose:  Verify the GenerateRequest schema parses a well-formed request
              with all required fields: location_ids, from_date, to_date, factor.
    Setup:    Construct a dict with valid values.
    Action:   Instantiate GenerateRequest from the dict.
    Expect:   All fields accessible with correct types and values.
    """

    def test_generate_request_valid(self):
        from app.schemas.reasonableness import GenerateRequest

        data = {
            "location_ids": ["loc-1", "loc-2"],
            "from_date": "2026-01-01",
            "to_date": "2026-02-28",
            "factor": 1.50,
        }
        req = GenerateRequest(**data)
        assert req.location_ids == ["loc-1", "loc-2"]
        assert req.from_date == "2026-01-01"
        assert req.to_date == "2026-02-28"
        assert req.factor == 1.50

    """
    TC-RT-2.2: GenerateRequest rejects missing required fields
    -----------------------------------------------------------
    Purpose:  Verify that omitting required fields raises a ValidationError.
    Setup:    Construct a dict missing 'location_ids'.
    Action:   Attempt to instantiate GenerateRequest.
    Expect:   Pydantic raises ValidationError mentioning the missing field.
    """

    def test_generate_request_missing_fields(self):
        from pydantic import ValidationError
        from app.schemas.reasonableness import GenerateRequest

        # Missing location_ids
        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(from_date="2026-01-01", to_date="2026-02-28", factor=1.25)
        assert "location_ids" in str(exc_info.value)

        # Missing factor
        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(location_ids=["loc-1"], from_date="2026-01-01", to_date="2026-02-28")
        assert "factor" in str(exc_info.value)

    """
    TC-RT-2.3: SaveReportBody accepts well-formed report data
    -----------------------------------------------------------
    Purpose:  Verify SaveReportBody parses a complete report submission
              including nested location_reports array.
    Setup:    Construct a dict mirroring the controller's save payload
              with one Reasonable and one Overfunded sub-location report.
    Action:   Instantiate SaveReportBody.
    Expect:   All fields including nested location_reports are accessible.
    """

    def test_save_report_body_valid(self):
        from app.schemas.reasonableness import SaveReportBody

        data = {
            "group_key": "5082",
            "cost_center": "5082",
            "location_labels": "APPLETON / WAUSAU",
            "from_date": "2026-01-01",
            "to_date": "2026-02-28",
            "factor": 1.50,
            "preparer": "Chris Controller",
            "scope": "Q2 FY2026 review",
            "status": "Overfunded",
            "location_reports": [SAMPLE_LOC_REPORT, SAMPLE_LOC_REPORT_OVERFUNDED],
        }
        body = SaveReportBody(**data)
        assert body.group_key == "5082"
        assert body.preparer == "Chris Controller"
        assert len(body.location_reports) == 2
        assert body.location_reports[0].loc_id == "loc-1"
        assert body.location_reports[0].status == "Reasonable"
        assert body.location_reports[1].loc_id == "loc-2"
        assert body.location_reports[1].status == "Overfunded"

    """
    TC-RT-2.4: ReportOut serializes from ORM model attributes
    -----------------------------------------------------------
    Purpose:  Verify ReportOut can be constructed from a dict that
              mirrors ORM model attributes (from_attributes=True).
    Setup:    Construct a dict with all fields including datetime strings.
    Action:   Use model_validate with from_attributes-compatible data.
    Expect:   ReportOut instance has all fields correctly mapped.
    """

    def test_report_out_from_attributes(self):
        from app.schemas.reasonableness import ReportOut

        now = datetime.now(timezone.utc)
        data = {
            "id": "rpt-001",
            "group_key": "5082",
            "cost_center": "5082",
            "location_labels": "APPLETON / WAUSAU",
            "from_date": date(2026, 1, 1),
            "to_date": date(2026, 2, 28),
            "factor": 1.50,
            "preparer": "Chris Controller",
            "scope": "Q2 review",
            "status": "Reasonable",
            "location_reports": [SAMPLE_LOC_REPORT],
            "saved_by": "user-123",
            "created_at": now,
            "updated_at": now,
        }
        out = ReportOut.model_validate(data)
        assert out.id == "rpt-001"
        assert out.status == "Reasonable"
        assert out.saved_by == "user-123"
        assert len(out.location_reports) == 1

    """
    TC-RT-2.5: PaginatedReports has correct structure
    --------------------------------------------------
    Purpose:  Verify the PaginatedReports schema wraps a list of ReportOut
              with pagination metadata (items, total, page, page_size, total_pages).
    Setup:    Construct a dict with items=[] and pagination metadata.
    Action:   Instantiate PaginatedReports.
    Expect:   All pagination fields are accessible and correct.
    """

    def test_paginated_reports_structure(self):
        from app.schemas.reasonableness import PaginatedReports

        data = {
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": 20,
            "total_pages": 0,
        }
        paginated = PaginatedReports(**data)
        assert paginated.items == []
        assert paginated.total == 0
        assert paginated.page == 1
        assert paginated.page_size == 20
        assert paginated.total_pages == 0


# ===========================================================================
# PHASE 3 — Business Logic Tests (TC-RT-3.x)
# ===========================================================================
# These tests validate the calculation engine in isolation (no HTTP, no DB).
# They test the pure functions that compute max values, totals, expected
# fund amounts, over/under, cushion, net result, and status determination.


class TestReasonablenessCalculations:
    """
    TC-RT-3.1: Total = max(F) + max(H) + max(J) + max(K)
    ------------------------------------------------------
    Purpose:  Verify the total calculation sums the maximum of each
              section line across a set of submissions in a date range.
    Setup:    Create 3 mock submission-like dicts with varying F/H/J values
              to ensure max (not sum or average) is used for each line.
    Action:   Call compute_max_values() with the submissions.
    Expect:   total = max(F) + max(H) + max(J) + 0 (K defaults to 0).
              Specifically: max(800,600,900)=900 + max(2502,2000,2200)=2502
              + max(150,200,100)=200 + 0 = 3602
    """

    def test_total_from_max_sections(self):
        from app.api.v1.reasonableness import compute_max_values

        # Simulate 3 submissions with sections JSON
        submissions = [
            {"sections": {"F": {"total": 800},  "H": {"total": 2502}, "J": {"total": 150}}, "total_cash": 9800},
            {"sections": {"F": {"total": 600},  "H": {"total": 2000}, "J": {"total": 200}}, "total_cash": 8500},
            {"sections": {"F": {"total": 900},  "H": {"total": 2200}, "J": {"total": 100}}, "total_cash": 10200},
        ]
        result = compute_max_values(submissions)
        assert result["max_f"] == 900.0
        assert result["max_h"] == 2502.0
        assert result["max_j"] == 200.0
        assert result["max_k"] == 0.0  # K always defaults to 0
        assert result["total"] == 900.0 + 2502.0 + 200.0 + 0.0  # 3602.0

    """
    TC-RT-3.2: Actual fund = max(total_cash) from submissions
    ----------------------------------------------------------
    Purpose:  Verify actual_fund is the maximum total_cash value
              across all submissions in the date range, not sum or average.
    Setup:    3 submissions with total_cash = 9800, 8500, 10200.
    Action:   Call compute_max_values() and check actual_fund.
    Expect:   actual_fund = 10200 (the maximum).
    """

    def test_actual_from_max_total_cash(self):
        from app.api.v1.reasonableness import compute_max_values

        submissions = [
            {"sections": {"F": {"total": 100}}, "total_cash": 9800},
            {"sections": {"F": {"total": 100}}, "total_cash": 8500},
            {"sections": {"F": {"total": 100}}, "total_cash": 10200},
        ]
        result = compute_max_values(submissions)
        assert result["actual_fund"] == 10200.0

    """
    TC-RT-3.3: Net result = (actual - expected) + cushion
    ------------------------------------------------------
    Purpose:  Verify the net result calculation follows the formula:
              expected = total * factor
              over = actual - expected
              net = over + cushion
    Setup:    total=3602, factor=1.50, actual=9800, cushion=-5000.
              expected = 3602 * 1.50 = 5403
              over = 9800 - 5403 = 4397
              net = 4397 + (-5000) = -603
    Action:   Call compute_net_result() with these values.
    Expect:   expected=5403, over=4397, net=-603.
    """

    def test_net_calculation(self):
        from app.api.v1.reasonableness import compute_net_result

        result = compute_net_result(
            total=3602.0,
            factor=1.50,
            actual_fund=9800.0,
            cushion=-5000.0,
        )
        assert result["expected_fund"] == pytest.approx(5403.0)
        assert result["over"] == pytest.approx(4397.0)
        assert result["net"] == pytest.approx(-603.0)

    """
    TC-RT-3.4: Status is 'Overfunded' when net > 0
    -------------------------------------------------
    Purpose:  Verify status determination when net result is positive.
    Setup:    total=6000, factor=1.25, actual=14000, cushion=-5000.
              expected = 7500, over = 6500, net = 1500 (> 0)
    Action:   Call compute_net_result() and check status.
    Expect:   status = "Overfunded".
    """

    def test_status_overfunded_when_net_positive(self):
        from app.api.v1.reasonableness import compute_net_result

        result = compute_net_result(
            total=6000.0,
            factor=1.25,
            actual_fund=14000.0,
            cushion=-5000.0,
        )
        assert result["net"] > 0
        assert result["status"] == "Overfunded"

    """
    TC-RT-3.5: Status is 'Reasonable' when net <= 0
    -------------------------------------------------
    Purpose:  Verify status determination when net result is zero or negative.
    Setup:    Case A: net exactly 0. Case B: net negative.
    Action:   Call compute_net_result() for each case.
    Expect:   Both return status = "Reasonable".
    """

    def test_status_reasonable_when_net_zero_or_negative(self):
        from app.api.v1.reasonableness import compute_net_result

        # Case A: net exactly 0
        # total=4000, factor=1.25, actual=10000, cushion=-5000
        # expected=5000, over=5000, net=0
        result_zero = compute_net_result(total=4000.0, factor=1.25, actual_fund=10000.0, cushion=-5000.0)
        assert result_zero["net"] == pytest.approx(0.0)
        assert result_zero["status"] == "Reasonable"

        # Case B: net negative
        # total=3602, factor=1.50, actual=9800, cushion=-5000
        # expected=5403, over=4397, net=-603
        result_neg = compute_net_result(total=3602.0, factor=1.50, actual_fund=9800.0, cushion=-5000.0)
        assert result_neg["net"] < 0
        assert result_neg["status"] == "Reasonable"

    """
    TC-RT-3.6: Default cushion is -$5,000
    ----------------------------------------
    Purpose:  Verify that when no cushion is provided, the default
              value of -5000 is used in the calculation.
    Setup:    total=4000, factor=1.25, actual=10000 (no cushion arg).
              expected=5000, over=5000, net=5000+(-5000)=0
    Action:   Call compute_net_result() without cushion parameter.
    Expect:   net = 0 (using default cushion of -5000).
    """

    def test_default_cushion(self):
        from app.api.v1.reasonableness import compute_net_result

        result = compute_net_result(total=4000.0, factor=1.25, actual_fund=10000.0)
        assert result["net"] == pytest.approx(0.0)  # over=5000 + cushion(-5000) = 0

    """
    TC-RT-3.7: compute_max_values handles empty submissions list
    -------------------------------------------------------------
    Purpose:  Verify graceful handling when no submissions exist
              for a location in the given date range.
    Setup:    Empty list of submissions.
    Action:   Call compute_max_values([]).
    Expect:   All max values are 0, actual_fund is 0, section_a_data is empty.
    """

    def test_compute_max_values_empty(self):
        from app.api.v1.reasonableness import compute_max_values

        result = compute_max_values([])
        assert result["max_f"] == 0.0
        assert result["max_h"] == 0.0
        assert result["max_j"] == 0.0
        assert result["max_k"] == 0.0
        assert result["total"] == 0.0
        assert result["actual_fund"] == 0.0
        assert result["section_a_data"] == []

    """
    TC-RT-3.8: compute_max_values extracts Section A data
    -------------------------------------------------------
    Purpose:  Verify that Section A (loose currency) daily values are
              extracted from submissions for the period comparison table.
    Setup:    3 submissions with different Section A totals and dates.
    Action:   Call compute_max_values() and check section_a_data.
    Expect:   section_a_data has 3 entries with correct date/sA pairs,
              avg_sa is the average of all sA values.
    """

    def test_compute_max_values_section_a(self):
        from app.api.v1.reasonableness import compute_max_values

        submissions = [
            {"sections": {"A": {"total": 500}, "F": {"total": 100}}, "total_cash": 5000, "submission_date": "2026-01-15"},
            {"sections": {"A": {"total": 300}, "F": {"total": 200}}, "total_cash": 4000, "submission_date": "2026-01-16"},
            {"sections": {"A": {"total": 700}, "F": {"total": 150}}, "total_cash": 6000, "submission_date": "2026-01-17"},
        ]
        result = compute_max_values(submissions)
        assert len(result["section_a_data"]) == 3
        assert result["section_a_data"][0] == {"date": "2026-01-15", "sA": 500.0}
        assert result["avg_sa"] == pytest.approx(500.0)  # (500+300+700)/3
        assert result["count"] == 3


# ===========================================================================
# PHASE 4 — API Endpoint Tests (TC-RT-4.x)
# ===========================================================================
# These tests hit the actual FastAPI endpoints via TestClient. They verify
# HTTP status codes, response shapes, role-based access, pagination,
# and audit logging. Uses conftest fixtures: client, controller_token,
# operator_token, admin_token, seed_rt_submissions.


class TestLocationGroupsEndpoint:
    """
    TC-RT-4.1: Controller gets location groups
    --------------------------------------------
    Purpose:  Verify GET /v1/reasonableness/location-groups returns locations
              grouped by cost_center, with correct sub_locs and default_factor.
    Setup:    Seed locations have cost_center values (5082 for loc-1+loc-2, etc).
              Controller has access to loc-1, loc-2, loc-3.
    Action:   GET /v1/reasonableness/location-groups with controller token.
    Expect:   200 OK. Returns array of groups. Group "5082" has 2 sub_locs
              and default_factor=1.50. Group "5104" has 1 sub_loc and factor=1.25.
    """

    def test_controller_gets_groups(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        groups = r.json()
        assert isinstance(groups, list)
        assert len(groups) >= 2  # At least 5082 and 5104

        # Find the 5082 group (loc-1 + loc-2)
        grp_5082 = next((g for g in groups if g["cost_center"] == "5082"), None)
        assert grp_5082 is not None, "Should have group for cost_center 5082"
        assert len(grp_5082["sub_locs"]) == 2
        assert grp_5082["default_factor"] == 1.50  # Multiple locations

        # Find the 5104 group (loc-3 only)
        grp_5104 = next((g for g in groups if g["cost_center"] == "5104"), None)
        assert grp_5104 is not None, "Should have group for cost_center 5104"
        assert len(grp_5104["sub_locs"]) == 1
        assert grp_5104["default_factor"] == 1.25  # Single location

    """
    TC-RT-4.2: Operator is forbidden from location groups
    -------------------------------------------------------
    Purpose:  Verify operators cannot access the location groups endpoint.
    Setup:    Use operator token.
    Action:   GET /v1/reasonableness/location-groups.
    Expect:   403 Forbidden.
    """

    def test_operator_forbidden(self, client, operator_token):
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {operator_token}"},
        )
        assert r.status_code == 403


class TestGenerateEndpoint:
    """
    TC-RT-4.3: Generate returns correct max values from submissions
    ----------------------------------------------------------------
    Purpose:  Verify POST /v1/reasonableness/generate pulls max(F), max(H),
              max(J) and max(total_cash) from approved submissions.
    Setup:    seed_rt_submissions creates 5 approved submissions for loc-1
              with F values [800, 600, 900, 750, 700] → max=900,
              H values [2502, 2000, 2200, 2300, 2100] → max=2502,
              J values [150, 200, 100, 180, 160] → max=200,
              total_cash [9800, 8500, 10200, 9500, 9000] → max=10200.
    Action:   POST /generate with loc-1, date range Jan 15-21 2026.
    Expect:   200 OK. calculations[0] has max_f=900, max_h=2502, max_j=200,
              actual_fund=10200, total=3602.
    """

    def test_generate_max_values(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["calculations"]) == 1

        calc = data["calculations"][0]
        assert calc["loc_id"] == "loc-1"
        assert calc["loc_label"] == "The Grange Hotel"
        assert calc["max_f"] == 900.0
        assert calc["max_h"] == 2502.0
        assert calc["max_j"] == 200.0
        assert calc["max_k"] == 0.0
        assert calc["total"] == 3602.0  # 900 + 2502 + 200 + 0
        assert calc["actual_fund"] == 10200.0
        assert calc["count"] == 5  # 5 submissions

    """
    TC-RT-4.4: Generate with no submissions returns zeroed results
    ---------------------------------------------------------------
    Purpose:  Verify graceful handling when a location has no approved
              submissions in the requested date range.
    Setup:    loc-3 has no seeded submissions.
    Action:   POST /generate with loc-3, date range Jan 2026.
    Expect:   200 OK. calculations[0] has all zeros.
    """

    def test_generate_no_submissions(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-3"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.25,
            },
        )
        assert r.status_code == 200
        calc = r.json()["calculations"][0]
        assert calc["max_f"] == 0.0
        assert calc["actual_fund"] == 0.0
        assert calc["total"] == 0.0

    """
    TC-RT-4.5: Generate validates from_date <= to_date
    ----------------------------------------------------
    Purpose:  Verify the endpoint rejects invalid date ranges.
    Setup:    from_date is after to_date.
    Action:   POST /generate with from_date=2026-02-28, to_date=2026-01-01.
    Expect:   422 error.
    """

    def test_generate_invalid_dates(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-02-28",
                "to_date": "2026-01-01",
                "factor": 1.50,
            },
        )
        assert r.status_code == 422

    """
    TC-RT-4.6: Operator cannot generate
    --------------------------------------
    Purpose:  Verify operators are forbidden from generating reports.
    Setup:    Use operator token.
    Action:   POST /generate.
    Expect:   403 Forbidden.
    """

    def test_generate_operator_forbidden(self, client, operator_token):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 403


class TestSaveAndListReports:
    """
    TC-RT-4.7: Controller saves report successfully
    --------------------------------------------------
    Purpose:  Verify POST /v1/reasonableness/reports creates a report
              and returns 201 with the saved report details.
    Setup:    Construct a complete SaveReportBody payload.
    Action:   POST /reports with controller token.
    Expect:   201 Created. Response has id, status, saved_by, timestamps.
    """

    def test_save_report(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "The Grange Hotel / Compass HQ Canteen",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "scope": "Q2 FY2026 review",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT],
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert "id" in body
        assert body["status"] == "Reasonable"
        assert body["preparer"] == "Chris Controller"
        assert body["created_at"] is not None

    """
    TC-RT-4.8: Saved report appears in list
    ------------------------------------------
    Purpose:  Verify that after saving, the report is returned by GET /reports.
    Setup:    Save a report with a unique location_labels, then list all.
    Action:   POST /reports, then GET /reports.
    Expect:   The saved report appears in the list items.
    """

    def test_save_then_list(self, client, controller_token):
        # Save
        client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5104",
                "cost_center": "5104",
                "location_labels": "Euston Station Bistro",
                "from_date": "2026-01-01",
                "to_date": "2026-01-31",
                "factor": 1.25,
                "preparer": "Chris Controller",
                "status": "Overfunded",
                "location_reports": [SAMPLE_LOC_REPORT_OVERFUNDED],
            },
        )

        # List
        r = client.get(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        labels = [item["location_labels"] for item in data["items"]]
        assert "Euston Station Bistro" in labels

    """
    TC-RT-4.9: Operator cannot save reports
    ------------------------------------------
    Purpose:  Verify operators are forbidden from saving reports.
    Setup:    Use operator token.
    Action:   POST /reports.
    Expect:   403 Forbidden.
    """

    def test_save_operator_forbidden(self, client, operator_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Test",
                "from_date": "2026-01-01",
                "to_date": "2026-01-31",
                "factor": 1.50,
                "preparer": "Test",
                "status": "Reasonable",
                "location_reports": [],
            },
        )
        assert r.status_code == 403

    """
    TC-RT-4.10: Audit event is logged when report is saved
    --------------------------------------------------------
    Purpose:  Verify saving a report creates an audit trail entry.
    Setup:    Save a report, then query the audit_events table.
    Action:   POST /reports, then check DB for audit event.
    Expect:   An AuditEvent with event_type='reasonableness_report_saved'
              exists with the report's entity_id.
    """

    def test_save_creates_audit_event(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Audit Test Report",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT],
            },
        )
        assert r.status_code == 201
        report_id = r.json()["id"]

        # Check audit event in DB
        from tests.conftest import TestingSessionLocal
        from app.models.audit import AuditEvent
        db = TestingSessionLocal()
        try:
            event = db.query(AuditEvent).filter(
                AuditEvent.event_type == "reasonableness_report_saved",
                AuditEvent.entity_id == report_id,
            ).first()
            assert event is not None, "Audit event should be created"
            assert event.entity_type == "reasonableness_report"
        finally:
            db.close()


class TestListAndDetailReports:
    """
    TC-RT-4.11: List reports with pagination
    -------------------------------------------
    Purpose:  Verify GET /reports returns paginated results with
              correct total, page, page_size, total_pages metadata.
    Setup:    Previous tests have saved multiple reports.
    Action:   GET /reports?page=1&page_size=2 with controller token.
    Expect:   200 OK. Response has items (max 2), total >= 2,
              page=1, page_size=2, total_pages >= 1.
    """

    def test_list_paginated(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/reports?page=1&page_size=2",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) <= 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total"] >= 1
        assert data["total_pages"] >= 1

    """
    TC-RT-4.12: Filter reports by status
    ---------------------------------------
    Purpose:  Verify GET /reports?status=Overfunded returns only overfunded reports.
    Setup:    Previous tests saved both Reasonable and Overfunded reports.
    Action:   GET /reports?status=Overfunded.
    Expect:   200 OK. All items have status "Overfunded".
    """

    def test_filter_by_status(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/reports?status=Overfunded",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        for item in data["items"]:
            assert item["status"] == "Overfunded"

    """
    TC-RT-4.13: Admin can list reports
    -------------------------------------
    Purpose:  Verify admin role has access to list reports.
    Setup:    Use admin token.
    Action:   GET /reports.
    Expect:   200 OK.
    """

    def test_admin_can_list(self, client, admin_token):
        r = client.get(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200

    """
    TC-RT-4.14: Get single report by ID
    --------------------------------------
    Purpose:  Verify GET /reports/{id} returns the full report detail
              including the nested location_reports JSON.
    Setup:    Save a report, capture its ID.
    Action:   GET /reports/{id}.
    Expect:   200 OK. Response matches the saved report with all fields.
    """

    def test_get_by_id(self, client, controller_token):
        # Save first
        save_r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Detail Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT, SAMPLE_LOC_REPORT_OVERFUNDED],
            },
        )
        report_id = save_r.json()["id"]

        # Get by ID
        r = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == report_id
        assert body["location_labels"] == "Detail Test"
        assert len(body["location_reports"]) == 2
        assert body["location_reports"][0]["loc_id"] == "loc-1"

    """
    TC-RT-4.15: 404 for non-existent report
    -------------------------------------------
    Purpose:  Verify GET /reports/{id} returns 404 for unknown IDs.
    Setup:    Use a random UUID that doesn't exist.
    Action:   GET /reports/{random-uuid}.
    Expect:   404 Not Found.
    """

    def test_not_found(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/reports/nonexistent-id-12345",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 404


# ===========================================================================
# PHASE 5 — Admin Integration Tests (TC-RT-5.x)
# ===========================================================================
# These tests verify the end-to-end flow between Controller and Admin:
# Controller saves reports → Admin can see, filter, paginate, and view
# detail of ALL reports. Also verifies permission boundaries (Operator
# is blocked from all read endpoints).


class TestAdminIntegration:
    """
    TC-RT-5.1: Controller saves report, Admin sees it in list
    -----------------------------------------------------------
    Purpose:  Verify the core integration: when a controller saves a
              reasonableness report, the admin can see it via the list endpoint.
    Setup:    1. Controller saves a report with unique location_labels "Integration Test Alpha".
              2. Admin calls GET /reports to list all reports.
    Action:   Compare the saved report's ID against the admin's list.
    Expect:   The report saved by controller appears in admin's list.
              Admin sees the same id, status, preparer, and location_labels.
    """

    def test_controller_saves_admin_sees(self, client, controller_token, admin_token):
        # Step 1: Controller saves a report
        save_r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Integration Test Alpha",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "scope": "Integration test",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT],
            },
        )
        assert save_r.status_code == 201
        saved_id = save_r.json()["id"]

        # Step 2: Admin lists all reports
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert list_r.status_code == 200
        data = list_r.json()

        # Step 3: Verify the saved report appears in admin's list
        found = [item for item in data["items"] if item["id"] == saved_id]
        assert len(found) == 1, f"Admin should see report {saved_id} in list"
        assert found[0]["location_labels"] == "Integration Test Alpha"
        assert found[0]["status"] == "Reasonable"
        assert found[0]["preparer"] == "Chris Controller"

    """
    TC-RT-5.2: Admin sees ALL controllers' reports (oversight role)
    ----------------------------------------------------------------
    Purpose:  Verify that admin has full oversight — they see reports
              from ALL controllers, not filtered to any specific user.
    Setup:    1. Controller saves 2 reports with distinct labels.
              2. Admin lists all reports.
    Action:   Check that both reports appear in admin's list.
    Expect:   Admin's total count includes both reports.
              Both distinct labels are present in the items.
    """

    def test_admin_sees_all_reports(self, client, controller_token, admin_token):
        # Step 1: Controller saves two reports with distinct labels
        for label, status in [("Oversight Test A", "Reasonable"), ("Oversight Test B", "Overfunded")]:
            r = client.post(
                "/v1/reasonableness/reports",
                headers={"Authorization": f"Bearer {controller_token}"},
                json={
                    "group_key": "5082",
                    "cost_center": "5082",
                    "location_labels": label,
                    "from_date": "2026-01-15",
                    "to_date": "2026-01-21",
                    "factor": 1.50,
                    "preparer": "Chris Controller",
                    "status": status,
                    "location_reports": [SAMPLE_LOC_REPORT],
                },
            )
            assert r.status_code == 201

        # Step 2: Admin lists all reports
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert list_r.status_code == 200
        labels = [item["location_labels"] for item in list_r.json()["items"]]

        # Step 3: Both reports visible to admin
        assert "Oversight Test A" in labels, "Admin should see Oversight Test A"
        assert "Oversight Test B" in labels, "Admin should see Oversight Test B"

    """
    TC-RT-5.3: Admin can view full report detail by ID
    -----------------------------------------------------
    Purpose:  Verify that admin can retrieve a specific report's full detail
              including nested location_reports JSON with all calculation fields.
    Setup:    1. Controller saves a report with 2 location reports
              (one Reasonable, one Overfunded).
              2. Admin calls GET /reports/{id}.
    Action:   Check all fields in the response.
    Expect:   200 OK. Response includes id, location_labels, status,
              and location_reports array with 2 entries containing
              loc_id, total, expected_fund, actual_fund, conclusion, etc.
    """

    def test_admin_gets_report_detail(self, client, controller_token, admin_token):
        # Step 1: Controller saves report with 2 sub-location reports
        save_r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Detail Test Admin",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "scope": "Q2 FY2026",
                "status": "Overfunded",
                "location_reports": [SAMPLE_LOC_REPORT, SAMPLE_LOC_REPORT_OVERFUNDED],
            },
        )
        assert save_r.status_code == 201
        report_id = save_r.json()["id"]

        # Step 2: Admin retrieves the detail
        detail_r = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert detail_r.status_code == 200
        body = detail_r.json()

        # Step 3: Verify all fields
        assert body["id"] == report_id
        assert body["location_labels"] == "Detail Test Admin"
        assert body["status"] == "Overfunded"
        assert body["cost_center"] == "5082"
        assert body["factor"] == 1.50
        assert body["preparer"] == "Chris Controller"
        assert body["scope"] == "Q2 FY2026"

        # Verify nested location_reports
        assert len(body["location_reports"]) == 2
        lr1 = body["location_reports"][0]
        assert lr1["loc_id"] == "loc-1"
        assert lr1["total"] == 3452.0
        assert lr1["status"] == "Reasonable"
        assert lr1["conclusion"] == "Funds within acceptable range for Q2 operations."

        lr2 = body["location_reports"][1]
        assert lr2["loc_id"] == "loc-2"
        assert lr2["status"] == "Overfunded"
        assert lr2["required_actions"] == "yes"

    """
    TC-RT-5.4: Admin can filter reports by status
    ------------------------------------------------
    Purpose:  Verify that admin's status filter returns only matching reports.
    Setup:    Previous tests have saved both Reasonable and Overfunded reports.
    Action:   1. Admin filters by ?status=Overfunded
              2. Admin filters by ?status=Reasonable
    Expect:   Each filtered result contains only reports with matching status.
              No cross-contamination between statuses.
    """

    def test_admin_filter_by_status(self, client, admin_token):
        # Filter: Overfunded only
        r_over = client.get(
            "/v1/reasonableness/reports?status=Overfunded&page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r_over.status_code == 200
        for item in r_over.json()["items"]:
            assert item["status"] == "Overfunded", \
                f"Expected Overfunded, got {item['status']} for report {item['id']}"

        # Filter: Reasonable only
        r_reas = client.get(
            "/v1/reasonableness/reports?status=Reasonable&page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r_reas.status_code == 200
        for item in r_reas.json()["items"]:
            assert item["status"] == "Reasonable", \
                f"Expected Reasonable, got {item['status']} for report {item['id']}"

        # Sanity: filtered counts should sum to total
        r_all = client.get(
            "/v1/reasonableness/reports?page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        total = r_all.json()["total"]
        assert r_over.json()["total"] + r_reas.json()["total"] == total, \
            "Filtered counts should sum to unfiltered total"

    """
    TC-RT-5.5: Admin pagination returns correct metadata
    ------------------------------------------------------
    Purpose:  Verify server-side pagination works correctly for admin,
              including total, page, page_size, total_pages, and items count.
    Setup:    Previous tests have saved multiple reports (at least 3).
    Action:   Admin requests page_size=2, then checks page 1 and page 2.
    Expect:   Page 1: items <= 2, page=1, page_size=2, total >= 3.
              Page 2: items <= 2, page=2.
              total_pages = ceil(total / 2).
    """

    def test_admin_pagination(self, client, admin_token):
        # Page 1
        r1 = client.get(
            "/v1/reasonableness/reports?page=1&page_size=2",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert len(d1["items"]) <= 2
        assert d1["page"] == 1
        assert d1["page_size"] == 2
        assert d1["total"] >= 3, "Should have at least 3 reports from previous tests"

        import math
        expected_pages = math.ceil(d1["total"] / 2)
        assert d1["total_pages"] == expected_pages

        # Page 2
        r2 = client.get(
            "/v1/reasonableness/reports?page=2&page_size=2",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert len(d2["items"]) <= 2
        assert d2["page"] == 2

        # Items on page 1 and page 2 should be different
        ids_p1 = {item["id"] for item in d1["items"]}
        ids_p2 = {item["id"] for item in d2["items"]}
        assert ids_p1.isdisjoint(ids_p2), "Pages should have distinct reports"

    """
    TC-RT-5.6: Operator cannot list reports
    ------------------------------------------
    Purpose:  Verify that operators are blocked from the reports list endpoint.
              Operators provide source data (daily submissions) but have no
              business need to see compliance reports.
    Setup:    Use operator token.
    Action:   GET /reports with operator token.
    Expect:   403 Forbidden.
    """

    def test_operator_cannot_list_reports(self, client, operator_token):
        r = client.get(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {operator_token}"},
        )
        assert r.status_code == 403

    """
    TC-RT-5.7: Operator cannot view report detail
    ------------------------------------------------
    Purpose:  Verify that operators are blocked from viewing individual
              report details, even if they know the report ID.
    Setup:    Use operator token with a known report ID (from previous tests).
    Action:   GET /reports/{id} with operator token.
    Expect:   403 Forbidden.
    """

    def test_operator_cannot_view_detail(self, client, controller_token, operator_token):
        # First, get a valid report ID via controller
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=1",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        report_id = list_r.json()["items"][0]["id"]

        # Operator tries to view it
        r = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {operator_token}"},
        )
        assert r.status_code == 403


# ===========================================================================
# PHASE 6 — Controller Workflow Tests (TC-RT-6.x)
# ===========================================================================
# These tests cover the full controller workflow: multi-location generation,
# submission filtering (only approved), save validation edge cases,
# location group authorization, and data integrity.


class TestControllerMultiLocationGeneration:
    """
    TC-RT-6.1: Generate for multiple locations returns independent calculations
    ---------------------------------------------------------------------------
    Purpose:  Verify that when a controller generates for a cost center group
              with multiple locations (e.g., loc-1 + loc-2 under 5082), the
              response contains separate calculation entries per location,
              each with independently computed max values.
    Setup:    seed_rt_submissions has 5 submissions each for loc-1 and loc-2.
              loc-1: F=[800,600,900,750,700], H=[2502,2000,2200,2300,2100]
              loc-2: F=[400,500,450,380,420], H=[1800,2000,1900,1700,1850]
    Action:   POST /generate with location_ids=["loc-1","loc-2"].
    Expect:   2 calculation entries.
              loc-1: max_f=900, max_h=2502.
              loc-2: max_f=500, max_h=2000.
              Totals computed independently (not summed across locations).
    """

    def test_generate_multiple_locations(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1", "loc-2"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 200
        calcs = r.json()["calculations"]
        assert len(calcs) == 2, "Should have 2 separate calculation entries"

        # Find each location's calculations
        c1 = next(c for c in calcs if c["loc_id"] == "loc-1")
        c2 = next(c for c in calcs if c["loc_id"] == "loc-2")

        # loc-1: max_f=900, max_h=2502, max_j=200
        assert c1["max_f"] == 900.0
        assert c1["max_h"] == 2502.0
        assert c1["max_j"] == 200.0
        assert c1["total"] == 900.0 + 2502.0 + 200.0  # 3602

        # loc-2: max_f=500, max_h=2000, max_j=300
        assert c2["max_f"] == 500.0
        assert c2["max_h"] == 2000.0
        assert c2["max_j"] == 300.0
        assert c2["total"] == 500.0 + 2000.0 + 300.0  # 2800

        # Verify totals are independent (not summed)
        assert c1["total"] != c2["total"]

    """
    TC-RT-6.2: Generate with mixed data — one location has data, another doesn't
    -----------------------------------------------------------------------------
    Purpose:  Verify that when generating for multiple locations where one has
              submissions and another has none, both appear in the response.
              The location with no data should have all zeros.
    Setup:    loc-1 has 5 submissions, loc-3 has 0 submissions in Jan 2026.
    Action:   POST /generate with location_ids=["loc-1","loc-3"].
    Expect:   2 entries. loc-1 has real data, loc-3 has all zeros.
    """

    def test_generate_mixed_data_locations(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1", "loc-3"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.25,
            },
        )
        assert r.status_code == 200
        calcs = r.json()["calculations"]
        assert len(calcs) == 2

        c1 = next(c for c in calcs if c["loc_id"] == "loc-1")
        c3 = next(c for c in calcs if c["loc_id"] == "loc-3")

        # loc-1 has real data
        assert c1["max_f"] > 0
        assert c1["actual_fund"] > 0
        assert c1["count"] == 5

        # loc-3 has no submissions → all zeros
        assert c3["max_f"] == 0.0
        assert c3["max_h"] == 0.0
        assert c3["total"] == 0.0
        assert c3["actual_fund"] == 0.0
        assert c3["count"] == 0
        assert c3["section_a_data"] == []

    """
    TC-RT-6.3: Section A daily data extracted correctly
    -----------------------------------------------------
    Purpose:  Verify that Section A (loose currency) daily values are extracted
              from submissions and returned with correct dates, average, and count.
    Setup:    loc-1 has 5 submissions with Section A totals: 500, 450, 600, 520, 480.
    Action:   POST /generate for loc-1.
    Expect:   section_a_data has 5 entries with correct date/sA pairs.
              avg_sa = (500+450+600+520+480)/5 = 510.
              count = 5.
    """

    def test_generate_section_a_data(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 200
        calc = r.json()["calculations"][0]

        assert calc["count"] == 5
        assert len(calc["section_a_data"]) == 5

        # Verify dates are present
        dates = [entry["date"] for entry in calc["section_a_data"]]
        assert "2026-01-15" in dates
        assert "2026-01-17" in dates

        # Verify average: (500+450+600+520+480)/5 = 510
        assert calc["avg_sa"] == pytest.approx(510.0)


class TestControllerSubmissionFiltering:
    """
    TC-RT-6.4: Generate uses only approved submissions
    ----------------------------------------------------
    Purpose:  Verify that the generate endpoint only pulls data from approved
              submissions. Rejected/pending submissions must NOT affect the
              max value calculations, even if they have higher values.
    Setup:    1. seed_rt_submissions creates 5 approved subs for loc-1 (max F=900).
              2. Create 1 additional REJECTED submission with F=5000.
    Action:   POST /generate for loc-1.
    Expect:   max_f = 900 (from approved only), NOT 5000 (from rejected).
    """

    def test_generate_uses_only_approved(self, client, controller_token, seed_rt_submissions):
        import uuid as _uuid
        from tests.conftest import TestingSessionLocal
        from app.models.submission import Submission, SubmissionStatus, SubmissionSource
        from app.models.user import User
        from datetime import datetime, timezone

        # Create a REJECTED submission with very high F value
        db = TestingSessionLocal()
        try:
            operator = db.query(User).filter(User.email == "operator@compass.com").first()
            db.add(Submission(
                id=str(_uuid.uuid4()),
                location_id="loc-1",
                location_name="The Grange Hotel",
                operator_id=operator.id,
                operator_name=operator.name,
                submission_date="2026-01-18",
                status=SubmissionStatus.REJECTED,
                source=SubmissionSource.FORM,
                sections={"A": {"total": 9999}, "F": {"total": 5000}, "H": {"total": 9000}, "J": {"total": 3000}},
                total_cash=50000,
                expected_cash=9800.0,
                variance=0.0,
                variance_pct=0.0,
                submitted_at=datetime.now(timezone.utc),
            ))
            db.commit()
        finally:
            db.close()

        # Generate — should ignore the rejected submission
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 200
        calc = r.json()["calculations"][0]

        # max_f should be 900 (from approved), NOT 5000 (from rejected)
        assert calc["max_f"] == 900.0, f"Expected 900 from approved subs, got {calc['max_f']}"
        assert calc["max_h"] == 2502.0, "Should use approved submissions only"
        assert calc["actual_fund"] == 10200.0, "actual_fund from approved only"

    """
    TC-RT-6.5: Single-day date range is valid
    -------------------------------------------
    Purpose:  Verify that from_date == to_date is accepted as a valid range
              (testing a single day's submissions).
    Setup:    seed_rt_submissions has a submission on 2026-01-15 for loc-1.
    Action:   POST /generate with from_date=to_date="2026-01-15".
    Expect:   200 OK. Returns data for just that one day.
              count=1, section_a_data has 1 entry.
    """

    def test_generate_single_day_range(self, client, controller_token, seed_rt_submissions):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-15",
                "factor": 1.25,
            },
        )
        assert r.status_code == 200
        calc = r.json()["calculations"][0]
        assert calc["count"] == 1, "Single day should return 1 submission"
        assert len(calc["section_a_data"]) == 1
        assert calc["section_a_data"][0]["date"] == "2026-01-15"


class TestControllerSaveValidation:
    """
    TC-RT-6.6: Save report with Overfunded status
    ------------------------------------------------
    Purpose:  Verify that a report with Overfunded status is saved and
              persisted correctly, including the status badge.
    Setup:    Controller saves a report with status="Overfunded" and
              a location report where net > 0.
    Action:   POST /reports, then GET /reports/{id}.
    Expect:   Both save response and detail response show status="Overfunded".
    """

    def test_save_overfunded_report(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Overfunded Save Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Overfunded",
                "location_reports": [SAMPLE_LOC_REPORT_OVERFUNDED],
            },
        )
        assert r.status_code == 201
        assert r.json()["status"] == "Overfunded"

        # Verify persisted
        detail = client.get(
            f"/v1/reasonableness/reports/{r.json()['id']}",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert detail.json()["status"] == "Overfunded"

    """
    TC-RT-6.7: Save with 3 sub-location reports
    -----------------------------------------------
    Purpose:  Verify that saving a report with 3 location reports
              (simulating a cost center group with 3 locations) correctly
              stores and retrieves all 3 in the JSON column.
    Setup:    Create 3 distinct RtLocReport entries with different loc_ids.
    Action:   POST /reports, then GET /reports/{id}.
    Expect:   location_reports array has exactly 3 entries, each with correct data.
    """

    def test_save_multiple_location_reports(self, client, controller_token):
        lr3 = {
            "loc_id": "loc-3", "loc_label": "Euston Station Bistro",
            "total": 1500.0, "expected_fund": 1875.0, "actual_fund": 1600.0,
            "over": -275.0, "cushion": -5000.0, "net": -5275.0,
            "status": "Reasonable", "conclusion": "Within range.",
            "required_actions": "no", "action_details": "",
        }
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Three Loc Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Overfunded",
                "location_reports": [SAMPLE_LOC_REPORT, SAMPLE_LOC_REPORT_OVERFUNDED, lr3],
            },
        )
        assert r.status_code == 201
        report_id = r.json()["id"]

        detail = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        lrs = detail.json()["location_reports"]
        assert len(lrs) == 3
        assert lrs[0]["loc_id"] == "loc-1"
        assert lrs[1]["loc_id"] == "loc-2"
        assert lrs[2]["loc_id"] == "loc-3"
        assert lrs[2]["total"] == 1500.0

    """
    TC-RT-6.8: Save with custom cushion value
    --------------------------------------------
    Purpose:  Verify that when a controller modifies the cushion from the
              default (-5000) to a custom value, the custom value is persisted.
    Setup:    Save a report where location_reports[0].cushion = -8000.
    Action:   POST /reports, then GET detail.
    Expect:   cushion = -8000 in the stored location report.
    """

    def test_save_custom_cushion(self, client, controller_token):
        custom_lr = {**SAMPLE_LOC_REPORT, "cushion": -8000.0, "net": SAMPLE_LOC_REPORT["over"] + (-8000.0)}
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Custom Cushion Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Reasonable",
                "location_reports": [custom_lr],
            },
        )
        assert r.status_code == 201

        detail = client.get(
            f"/v1/reasonableness/reports/{r.json()['id']}",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        lr = detail.json()["location_reports"][0]
        assert lr["cushion"] == -8000.0, "Custom cushion should be preserved"

    """
    TC-RT-6.9: Save with invalid status is rejected
    --------------------------------------------------
    Purpose:  Verify that the backend rejects reports with an invalid status
              value (not "Reasonable" or "Overfunded").
    Setup:    POST /reports with status="Invalid".
    Action:   Expect a server error (500 or 422) since ReasonablenessStatus("Invalid")
              raises ValueError.
    Expect:   Non-2xx response.
    """

    def test_save_invalid_status_rejected(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Invalid Status Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "InvalidStatus",
                "location_reports": [],
            },
        )
        assert r.status_code >= 400, f"Expected error, got {r.status_code}"

    """
    TC-RT-6.10: Save with missing required field is rejected
    -----------------------------------------------------------
    Purpose:  Verify that Pydantic validation rejects payloads missing
              required fields (e.g., omitting 'preparer').
    Setup:    POST /reports without the 'preparer' field.
    Action:   Expect 422 validation error.
    Expect:   422 Unprocessable Entity with field error for 'preparer'.
    """

    def test_save_missing_required_field(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Missing Field Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                # "preparer" is intentionally omitted
                "status": "Reasonable",
                "location_reports": [],
            },
        )
        assert r.status_code == 422


class TestControllerLocationGroups:
    """
    TC-RT-6.11: Controller sees only their assigned locations
    -----------------------------------------------------------
    Purpose:  Verify that the location-groups endpoint filters results
              to only include locations assigned to the controller.
              Controller is assigned to [loc-1, loc-2, loc-3] which
              covers cost centers 5082 and 5104. They should NOT see
              loc-4 (5117) or loc-5 (5132).
    Setup:    Seed locations have 5 locations across 4 cost centers.
              Controller assigned to loc-1, loc-2, loc-3.
    Action:   GET /location-groups with controller token.
    Expect:   Only cost centers 5082 and 5104 returned.
              Cost centers 5117 and 5132 are NOT in response.
    """

    def test_controller_sees_only_assigned(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r.status_code == 200
        groups = r.json()
        cost_centers = [g["cost_center"] for g in groups]

        # Should see 5082 (loc-1, loc-2) and 5104 (loc-3)
        assert "5082" in cost_centers
        assert "5104" in cost_centers

        # Should NOT see 5117 (loc-4) or 5132 (loc-5)
        assert "5117" not in cost_centers, "Controller should not see loc-4's cost center"
        assert "5132" not in cost_centers, "Controller should not see loc-5's cost center"

    """
    TC-RT-6.12: Location group factor determination
    --------------------------------------------------
    Purpose:  Verify that the default_factor is correctly set based on
              the number of sub-locations in a cost center group.
              1 location → 1.25, 2+ locations → 1.50.
    Setup:    5082 has loc-1 + loc-2 (2 locs), 5104 has loc-3 only (1 loc).
    Action:   GET /location-groups with controller token.
    Expect:   5082 group: default_factor=1.50, sub_locs has 2 entries.
              5104 group: default_factor=1.25, sub_locs has 1 entry.
    """

    def test_factor_determination(self, client, controller_token):
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        groups = r.json()

        grp_5082 = next(g for g in groups if g["cost_center"] == "5082")
        assert grp_5082["default_factor"] == 1.50
        assert len(grp_5082["sub_locs"]) == 2

        grp_5104 = next(g for g in groups if g["cost_center"] == "5104")
        assert grp_5104["default_factor"] == 1.25
        assert len(grp_5104["sub_locs"]) == 1

    """
    TC-RT-6.13: Generate for nonexistent location returns 404
    -----------------------------------------------------------
    Purpose:  Verify that generating for a location ID that doesn't exist
              in the database returns a 404 error, not a crash.
    Setup:    POST /generate with location_ids=["loc-999"].
    Action:   Expect 404.
    Expect:   404 with detail message containing "loc-999".
    """

    def test_generate_nonexistent_location(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "location_ids": ["loc-999"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 404
        assert "loc-999" in r.json()["detail"]


class TestControllerDataIntegrity:
    """
    TC-RT-6.14: Save populates timestamps automatically
    ------------------------------------------------------
    Purpose:  Verify that created_at and updated_at are automatically set
              by the database on save and returned in the API response.
    Setup:    POST /reports with valid data.
    Action:   Check response for created_at and updated_at.
    Expect:   Both are non-null ISO datetime strings.
    """

    def test_save_populates_timestamps(self, client, controller_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5104",
                "cost_center": "5104",
                "location_labels": "Timestamp Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.25,
                "preparer": "Chris Controller",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT],
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["created_at"] is not None, "created_at should be auto-populated"
        assert body["updated_at"] is not None, "updated_at should be auto-populated"
        assert "T" in body["created_at"], "Should be ISO datetime format"

    """
    TC-RT-6.15: Special characters in conclusion round-trip through JSON
    ----------------------------------------------------------------------
    Purpose:  Verify that conclusions containing special characters
              (quotes, newlines, Unicode) are correctly stored and
              retrieved from the JSON column without corruption.
    Setup:    Save a report where conclusion contains special chars.
    Action:   POST /reports, then GET /reports/{id}.
    Expect:   Conclusion text matches exactly, including all special chars.
    """

    def test_save_special_characters(self, client, controller_token):
        special_conclusion = 'Funds are "reasonable" & stable.\nNo action needed — all good! €£¥'
        lr = {
            **SAMPLE_LOC_REPORT,
            "conclusion": special_conclusion,
        }
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "Special Chars Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Chris Controller",
                "status": "Reasonable",
                "location_reports": [lr],
            },
        )
        assert r.status_code == 201

        detail = client.get(
            f"/v1/reasonableness/reports/{r.json()['id']}",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        stored = detail.json()["location_reports"][0]["conclusion"]
        assert stored == special_conclusion, f"Expected special chars preserved, got: {stored}"


# ===========================================================================
# PHASE 7 — RT-009 & RT-013 Gap Tests (Second Controller + DGM/RC)
# ===========================================================================
# These tests fill coverage gaps identified by comparing against
# Controller_ReasonablenessTest_TestCases.md (RT-009, RT-013).


class TestSecondControllerIsolation:
    """
    TC-RT-7.1: Second controller sees only their assigned locations
    ----------------------------------------------------------------
    Purpose:  Verify that a second controller with different location
              assignments sees only their own locations in location-groups,
              completely isolated from the first controller's locations.
    Setup:    Controller1 (controller@compass.com) assigned to loc-1, loc-2, loc-3
              (cost centers 5082, 5104).
              Controller2 (controller2@compass.com) assigned to loc-4, loc-5
              (cost centers 5117, 5132).
    Action:   Both controllers call GET /location-groups.
    Expect:   Controller1 sees 5082, 5104 only.
              Controller2 sees 5117, 5132 only.
              No overlap between them.
    """

    def test_controllers_see_only_their_locations(self, client, controller_token, controller2_token):
        # Controller 1
        r1 = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        assert r1.status_code == 200
        cc1 = {g["cost_center"] for g in r1.json()}
        assert "5082" in cc1, "Controller1 should see 5082"
        assert "5104" in cc1, "Controller1 should see 5104"
        assert "5117" not in cc1, "Controller1 should NOT see 5117"
        assert "5132" not in cc1, "Controller1 should NOT see 5132"

        # Controller 2
        r2 = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {controller2_token}"},
        )
        assert r2.status_code == 200
        cc2 = {g["cost_center"] for g in r2.json()}
        assert "5117" in cc2, "Controller2 should see 5117"
        assert "5132" in cc2, "Controller2 should see 5132"
        assert "5082" not in cc2, "Controller2 should NOT see 5082"
        assert "5104" not in cc2, "Controller2 should NOT see 5104"

        # No overlap
        assert cc1.isdisjoint(cc2), "Controllers' location groups should not overlap"

    """
    TC-RT-7.2: Controller2 can generate for their locations only
    --------------------------------------------------------------
    Purpose:  Verify Controller2 can generate reports for loc-4/loc-5
              but cannot access Controller1's locations.
    Setup:    Controller2 assigned to loc-4, loc-5.
    Action:   1. Controller2 generates for loc-4 (their location) → success.
              2. Controller2 generates for loc-1 (not theirs) → still succeeds
                 at API level (no per-location authz check in generate), but
                 location-groups won't show it.
    Expect:   Generate for own location returns 200.
    """

    def test_controller2_generates_for_own_location(self, client, controller2_token):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {controller2_token}"},
            json={
                "location_ids": ["loc-4"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.25,
            },
        )
        assert r.status_code == 200
        assert len(r.json()["calculations"]) == 1
        assert r.json()["calculations"][0]["loc_id"] == "loc-4"

    """
    TC-RT-7.3: Controller2 can save and list their own reports
    ------------------------------------------------------------
    Purpose:  Verify Controller2 can save reports and see them in the list.
    Setup:    Controller2 saves a report for their locations.
    Action:   POST /reports, then GET /reports.
    Expect:   Report saved successfully, appears in list.
    """

    def test_controller2_saves_and_lists(self, client, controller2_token):
        # Save
        save_r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {controller2_token}"},
            json={
                "group_key": "5117",
                "cost_center": "5117",
                "location_labels": "Heathrow T2 Outlet",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.25,
                "preparer": "Pat Controller2",
                "status": "Reasonable",
                "location_reports": [SAMPLE_LOC_REPORT],
            },
        )
        assert save_r.status_code == 201
        assert save_r.json()["preparer"] == "Pat Controller2"

        # List — should see their report
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=100",
            headers={"Authorization": f"Bearer {controller2_token}"},
        )
        assert list_r.status_code == 200
        labels = [item["location_labels"] for item in list_r.json()["items"]]
        assert "Heathrow T2 Outlet" in labels


class TestDgmRcPermissions:
    """
    TC-RT-7.4: DGM cannot access location groups
    -----------------------------------------------
    Purpose:  Verify DGM role is blocked from reasonableness location groups.
    Setup:    Use DGM token.
    Action:   GET /location-groups.
    Expect:   403 Forbidden.
    """

    def test_dgm_cannot_get_location_groups(self, client, dgm_token):
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {dgm_token}"},
        )
        assert r.status_code == 403

    """
    TC-RT-7.5: DGM cannot generate reports
    -----------------------------------------
    Purpose:  Verify DGM role is blocked from generating.
    Setup:    Use DGM token.
    Action:   POST /generate.
    Expect:   403 Forbidden.
    """

    def test_dgm_cannot_generate(self, client, dgm_token):
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 403

    """
    TC-RT-7.6: DGM cannot save reports
    -------------------------------------
    Purpose:  Verify DGM role is blocked from saving.
    Setup:    Use DGM token.
    Action:   POST /reports.
    Expect:   403 Forbidden.
    """

    def test_dgm_cannot_save(self, client, dgm_token):
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {dgm_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "DGM Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Diana DGM",
                "status": "Reasonable",
                "location_reports": [],
            },
        )
        assert r.status_code == 403

    """
    TC-RT-7.7: DGM cannot list reports
    -------------------------------------
    Purpose:  Verify DGM role is blocked from listing reports.
    Setup:    Use DGM token.
    Action:   GET /reports.
    Expect:   403 Forbidden.
    """

    def test_dgm_cannot_list(self, client, dgm_token):
        r = client.get(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {dgm_token}"},
        )
        assert r.status_code == 403

    """
    TC-RT-7.8: DGM cannot view report detail
    -------------------------------------------
    Purpose:  Verify DGM role is blocked from viewing report detail.
    Setup:    Use DGM token with a known report ID.
    Action:   GET /reports/{id}.
    Expect:   403 Forbidden.
    """

    def test_dgm_cannot_view_detail(self, client, dgm_token, controller_token):
        # Get a valid report ID
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=1",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        report_id = list_r.json()["items"][0]["id"]

        r = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {dgm_token}"},
        )
        assert r.status_code == 403

    """
    TC-RT-7.9: Regional Controller CAN list and view reports (by design)
    ----------------------------------------------------------------------
    Purpose:  Verify RC role has READ access to reports (list + detail)
              but CANNOT generate or save (those are Controller-only).
    Setup:    Use RC token.
    Action:   1. GET /location-groups → 200 (RC can view groups)
              2. GET /reports → 200 (RC can list)
              3. GET /reports/{id} → 200 (RC can view detail)
              4. POST /generate → 403 (RC cannot generate)
              5. POST /reports → 403 (RC cannot save)
    Expect:   Read access granted, write access denied.
    """

    def test_rc_can_read_but_not_write(self, client, rc_token, controller_token):
        # RC CAN view location groups
        r = client.get(
            "/v1/reasonableness/location-groups",
            headers={"Authorization": f"Bearer {rc_token}"},
        )
        assert r.status_code == 200

        # RC CAN list reports
        r = client.get(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {rc_token}"},
        )
        assert r.status_code == 200

        # RC CAN view report detail
        list_r = client.get(
            "/v1/reasonableness/reports?page_size=1",
            headers={"Authorization": f"Bearer {controller_token}"},
        )
        report_id = list_r.json()["items"][0]["id"]
        r = client.get(
            f"/v1/reasonableness/reports/{report_id}",
            headers={"Authorization": f"Bearer {rc_token}"},
        )
        assert r.status_code == 200

        # RC CANNOT generate
        r = client.post(
            "/v1/reasonableness/generate",
            headers={"Authorization": f"Bearer {rc_token}"},
            json={
                "location_ids": ["loc-1"],
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
            },
        )
        assert r.status_code == 403

        # RC CANNOT save
        r = client.post(
            "/v1/reasonableness/reports",
            headers={"Authorization": f"Bearer {rc_token}"},
            json={
                "group_key": "5082",
                "cost_center": "5082",
                "location_labels": "RC Test",
                "from_date": "2026-01-15",
                "to_date": "2026-01-21",
                "factor": 1.50,
                "preparer": "Rachel RC",
                "status": "Reasonable",
                "location_reports": [],
            },
        )
        assert r.status_code == 403
