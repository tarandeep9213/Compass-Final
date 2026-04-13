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

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus
from app.models.config import SystemConfig
from app.services.email import send_submission_reminder, send_sla_breach

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
    """Email operators who haven't submitted today."""
    db = SessionLocal()
    try:
        today = date.today().isoformat()
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
    """Email controllers for submissions pending approval past SLA threshold."""
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
        CronTrigger(hour=int(hour), minute=int(minute)),
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
    _scheduler.start()
    logger.info("Scheduler started — daily_reminder at %s:%s UTC, sla_check every 1h", hour, minute)


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
