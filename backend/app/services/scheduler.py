"""
Background scheduler — runs daily jobs.
Jobs:
  1. daily_reminder   — fires at config.daily_reminder_time
                        Emails operators who have NOT submitted today.
  2. sla_breach_check — fires every hour
                        Emails controllers + admins for submissions pending > SLA hours.
"""
import asyncio
import logging
from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# Timezone for the daily_reminder / visit_reminder cron jobs.
# Without this, APScheduler defaults to container local time (UTC in our
# prod containers), which fired reminders at 3 AM for US operators.
# All stored timestamps + SLA math remain UTC — this only affects when
# the daily cron jobs fire.
SCHEDULER_TZ = ZoneInfo("America/Chicago")

from app.db.session import SessionLocal
from app.core.business_days import is_business_day
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus
from app.models.verification import Verification, VerificationStatus
from app.models.config import SystemConfig
from app.services.email import send_submission_reminder, send_sla_breach, send_visit_reminder

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def _get_config(db) -> SystemConfig:
    return db.get(SystemConfig, 1) or SystemConfig()


def _run_async(coro) -> None:
    """Run a coroutine synchronously from a sync APScheduler job."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coro)
    finally:
        loop.close()


# ── Job 1: Daily submission reminder ─────────────────────────────────────────

def job_daily_reminder() -> None:
    """Email operators who haven't submitted today.

    Skips weekends — cashrooms don't operate Sat/Sun so no reminder is useful.
    Uses SCHEDULER_TZ (not the container's UTC) so "today" matches the
    operator's notion of the day.
    """
    today_local = datetime.now(SCHEDULER_TZ).date()
    if not is_business_day(today_local):
        logger.info("Skipping daily_reminder — %s is a weekend", today_local)
        return
    db = SessionLocal()
    try:
        today = today_local.isoformat()
        cfg = _get_config(db)

        # Find all active operators
        operators = db.query(User).filter(
            User.active == True,
            User.role == UserRole.OPERATOR,
        ).all()

        for op in operators:
            for loc_id in (op.location_ids or []):
                # Check if submission exists today for this location
                existing = db.query(Submission).filter(
                    Submission.operator_id == op.id,
                    Submission.location_id == loc_id,
                    Submission.submission_date == today,
                    Submission.status != SubmissionStatus.DRAFT,
                ).first()

                if not existing:
                    loc = db.get(Location, loc_id)
                    loc_name = loc.name if loc else loc_id
                    logger.info("Sending daily reminder to %s for %s", op.email, loc_name)
                    _run_async(send_submission_reminder(
                        to=op.email,
                        name=op.name,
                        location_name=loc_name,
                        today=today,
                    ))
    except Exception as exc:
        logger.error("daily_reminder job failed: %s", exc)
    finally:
        db.close()


# ── Job 2: SLA breach check ───────────────────────────────────────────────────

def job_sla_breach_check() -> None:
    """Email controllers for submissions pending approval past SLA threshold.

    Skips weekends — controllers don't approve on Sat/Sun, so a Friday
    submission doesn't need to wake them up Saturday night. The breach
    still exists; emails resume Monday morning when the job next runs
    on a business day. The SLA cutoff timestamp itself is unchanged —
    this only controls *when* the notification is sent.
    """
    if not is_business_day(datetime.now(SCHEDULER_TZ).date()):
        return
    db = SessionLocal()
    try:
        cfg = _get_config(db)
        sla_hours = cfg.approval_sla_hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=sla_hours)

        overdue = db.query(Submission).filter(
            Submission.status == SubmissionStatus.PENDING_APPROVAL,
            Submission.submitted_at <= cutoff,
        ).all()

        if not overdue:
            return

        # Notify controllers
        controllers = db.query(User).filter(
            User.active == True,
            User.role == UserRole.CONTROLLER,
        ).all()

        for sub in overdue:
            hours_pending = int(
                (datetime.now(timezone.utc) - sub.submitted_at).total_seconds() / 3600
            )
            submitted_at_str = sub.submitted_at.strftime("%Y-%m-%d %H:%M UTC") if sub.submitted_at else "unknown"

            for ctrl in controllers:
                if sub.location_id not in (ctrl.location_ids or []):
                    continue
                logger.warning("SLA breach: submission %s for %s (%dh pending)",
                               sub.id, sub.location_name, hours_pending)
                _run_async(send_sla_breach(
                    to=ctrl.email,
                    name=ctrl.name,
                    location_name=sub.location_name,
                    operator_name=sub.operator_name,
                    submission_date=sub.submission_date,
                    submitted_at=submitted_at_str,
                    sla_hours=sla_hours,
                    hours_pending=hours_pending,
                ))
    except Exception as exc:
        logger.error("sla_breach_check job failed: %s", exc)
    finally:
        db.close()


# ── Job 3: Visit day reminder ─────────────────────────────────────────────────

def job_visit_reminder() -> None:
    """Email controllers/DGMs who have visits scheduled for today."""
    db = SessionLocal()
    try:
        today = date.today().isoformat()

        visits = db.query(Verification).filter(
            Verification.verification_date == today,
            Verification.status == VerificationStatus.SCHEDULED,
        ).all()

        for v in visits:
            user = db.query(User).filter(User.id == v.verifier_id).first()
            if not user or not user.active:
                continue
            visit_type = "Controller" if v.verification_type.value == "CONTROLLER" else "DGM"
            logger.info("Sending visit reminder to %s for %s at %s", user.email, v.location_name, today)
            _run_async(send_visit_reminder(
                to=user.email,
                name=user.name,
                visit_type=visit_type,
                location_name=v.location_name,
                visit_date=today,
            ))
    except Exception as exc:
        logger.error("visit_reminder job failed: %s", exc)
    finally:
        db.close()


# ── Scheduler lifecycle ───────────────────────────────────────────────────────

def start_scheduler() -> None:
    if _scheduler.running:
        return

    db = SessionLocal()
    try:
        cfg = _get_config(db)
        hour, minute = cfg.daily_reminder_time.split(":")
    except Exception:
        hour, minute = "8", "0"
    finally:
        db.close()

    _scheduler.add_job(
        job_daily_reminder,
        CronTrigger(hour=int(hour), minute=int(minute), timezone=SCHEDULER_TZ),
        id="daily_reminder",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        job_sla_breach_check,
        IntervalTrigger(hours=1),
        id="sla_breach_check",
        replace_existing=True,
    )
    _scheduler.add_job(
        job_visit_reminder,
        CronTrigger(hour=8, minute=0, timezone=SCHEDULER_TZ),
        id="visit_reminder",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()
    logger.info("Scheduler started — daily_reminder at %s:%s %s, visit_reminder at 08:00 %s, sla_check every 1h",
                hour, minute, SCHEDULER_TZ.key, SCHEDULER_TZ.key)


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
