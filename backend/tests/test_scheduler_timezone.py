"""
Regression checks for BUGS_2026-04-20:
  #3 — daily/visit reminder cron triggers must fire in local (US Central) time.
  #1 — daily_reminder and sla_breach_check must skip on Sat/Sun.
"""
from datetime import date
from unittest.mock import patch

from app.services.scheduler import (
    SCHEDULER_TZ,
    _scheduler,
    job_daily_reminder,
    job_sla_breach_check,
    start_scheduler,
)


def test_cron_triggers_use_local_timezone():
    start_scheduler()
    try:
        daily = _scheduler.get_job("daily_reminder")
        visit = _scheduler.get_job("visit_reminder")
        sla = _scheduler.get_job("sla_breach_check")

        assert daily is not None, "daily_reminder job not registered"
        assert visit is not None, "visit_reminder job not registered"
        assert sla is not None, "sla_breach_check job not registered"

        # The two cron jobs must carry the local tz so they fire at the
        # operators' morning, not 08:00 UTC (= 3 AM Central).
        assert str(daily.trigger.timezone) == "America/Chicago"
        assert str(visit.trigger.timezone) == "America/Chicago"

        # SLA check is interval-based; timezone-independent by design.
        assert "IntervalTrigger" in type(sla.trigger).__name__

        # Sanity-check the module constant.
        assert SCHEDULER_TZ.key == "America/Chicago"
    finally:
        # Stop so subsequent test modules don't get a running scheduler.
        if _scheduler.running:
            _scheduler.shutdown(wait=False)


# ── Weekend-skip behavior (BUGS_2026-04-20 #1) ─────────────────────────────

def _fake_datetime(day: date):
    """Return a datetime that will produce `day` when .date() is called —
    regardless of what tz is passed."""
    class _FakeDT:
        @staticmethod
        def now(tz=None):
            class _D:
                @staticmethod
                def date():
                    return day
            return _D()
    return _FakeDT


def test_daily_reminder_skips_saturday():
    """Saturday (weekday=5) → job returns early without opening a DB session."""
    with patch("app.services.scheduler.datetime", _fake_datetime(date(2026, 4, 25))), \
         patch("app.services.scheduler.SessionLocal") as mock_session:
        job_daily_reminder()
        mock_session.assert_not_called()


def test_daily_reminder_skips_sunday():
    with patch("app.services.scheduler.datetime", _fake_datetime(date(2026, 4, 26))), \
         patch("app.services.scheduler.SessionLocal") as mock_session:
        job_daily_reminder()
        mock_session.assert_not_called()


def test_daily_reminder_runs_on_monday():
    """Monday (weekday=0) → job proceeds past the guard and opens a session."""
    with patch("app.services.scheduler.datetime", _fake_datetime(date(2026, 4, 27))), \
         patch("app.services.scheduler.SessionLocal") as mock_session:
        # Make the session return empty query results so the rest of the job is a no-op.
        mock_session.return_value.query.return_value.filter.return_value.all.return_value = []
        job_daily_reminder()
        mock_session.assert_called_once()


def test_sla_breach_check_skips_sunday():
    with patch("app.services.scheduler.datetime", _fake_datetime(date(2026, 4, 26))), \
         patch("app.services.scheduler.SessionLocal") as mock_session:
        job_sla_breach_check()
        mock_session.assert_not_called()
