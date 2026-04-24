"""Dashboard treats weekends as closed: no 'red' just because it's Sat/Sun,
and the 30-day submission rate uses a business-day denominator."""
from app.api.v1.compliance import _location_health


def test_weekend_no_submission_is_green_not_red():
    h = _location_health(
        has_submission_today=False,
        submission_status=None,
        variance_exception=False,
        days_since_controller=10,
        sla_hours=48,
        business_day_today=False,
    )
    assert h == "green"


def test_weekday_no_submission_still_red():
    h = _location_health(
        has_submission_today=False,
        submission_status=None,
        variance_exception=False,
        days_since_controller=10,
        sla_hours=48,
        business_day_today=True,
    )
    assert h == "red"


def test_weekend_with_stale_controller_is_amber():
    # Controller-staleness must still surface even on weekends.
    h = _location_health(
        has_submission_today=False,
        submission_status=None,
        variance_exception=False,
        days_since_controller=45,
        sla_hours=48,
        business_day_today=False,
    )
    assert h == "amber"


def test_weekday_rejected_submission_still_red():
    # Regression: rejected-status behavior unchanged.
    h = _location_health(
        has_submission_today=True,
        submission_status="rejected",
        variance_exception=False,
        days_since_controller=10,
        sla_hours=48,
        business_day_today=True,
    )
    assert h == "red"


def test_weekend_rejected_submission_still_red():
    # A rejected submission is a problem regardless of weekend.
    h = _location_health(
        has_submission_today=True,
        submission_status="rejected",
        variance_exception=False,
        days_since_controller=10,
        sla_hours=48,
        business_day_today=False,
    )
    assert h == "red"


def test_default_business_day_true_preserves_prior_callers():
    # Explicit regression: old callers that don't pass business_day_today
    # behave exactly as before.
    h = _location_health(
        has_submission_today=False,
        submission_status=None,
        variance_exception=False,
        days_since_controller=None,
        sla_hours=48,
    )
    assert h == "red"
