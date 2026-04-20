"""
Regression check for BUGS_2026-04-20 #3 — daily/visit reminder cron
triggers must fire in local (US Central) time, not UTC.
"""
from app.services.scheduler import SCHEDULER_TZ, _scheduler, start_scheduler


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
