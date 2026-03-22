"""
Email service — wraps fastapi-mail with Jinja2 templates.
Set EMAIL_ENABLED=false in .env to suppress all sending (useful for tests).
Local dev: point at Mailhog (localhost:1025), view at http://localhost:8025
"""
import logging
from pathlib import Path

from fastapi import BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"

_jinja = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

_mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_FROM_NAME=settings.FROM_NAME,
    MAIL_STARTTLS=settings.SMTP_STARTTLS,
    MAIL_SSL_TLS=settings.SMTP_SSL_TLS,
    USE_CREDENTIALS=bool(settings.SMTP_USER),
    VALIDATE_CERTS=False,
    SUPPRESS_SEND=not settings.EMAIL_ENABLED,
)

_fastmail = FastMail(_mail_config)


async def _send(to: list[str], subject: str, template: str, ctx: dict) -> None:
    """Internal: render template and send. Never raises — logs errors instead."""
    if not settings.EMAIL_ENABLED:
        logger.debug("EMAIL_ENABLED=false — skipping send to %s: %s", to, subject)
        return
    try:
        html = _jinja.get_template(template).render(**ctx)
        msg = MessageSchema(
            subject=subject,
            recipients=to,
            body=html,
            subtype=MessageType.html,
        )
        await _fastmail.send_message(msg)
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s — %s", to, subject, exc)


def send_email_background(
    background: BackgroundTasks,
    to: list[str],
    subject: str,
    template: str,
    ctx: dict,
) -> None:
    """Queue email in FastAPI BackgroundTasks — non-blocking."""
    background.add_task(_send, to, subject, template, ctx)


# ── Convenience senders (used by route handlers) ─────────────────────────────

async def send_welcome(to: str, name: str, temp_password: str) -> None:
    await _send(
        to=[to],
        subject="Welcome to CashRoom Compass",
        template="welcome.html",
        ctx={"name": name, "email": to, "temp_password": temp_password},
    )


async def send_submission_reminder(to: str, name: str, location_name: str, today: str) -> None:
    await _send(
        to=[to],
        subject=f"Reminder: Cash Count Submission Due — {location_name}",
        template="submission_reminder.html",
        ctx={"name": name, "location_name": location_name, "today": today},
    )


async def send_sla_breach(
    to: str, name: str, location_name: str, operator_name: str,
    submission_date: str, submitted_at: str, sla_hours: int, hours_pending: int,
) -> None:
    await _send(
        to=[to],
        subject=f"SLA Breach: Submission Overdue — {location_name}",
        template="sla_breach.html",
        ctx={
            "name": name,
            "location_name": location_name,
            "operator_name": operator_name,
            "submission_date": submission_date,
            "submitted_at": submitted_at,
            "sla_hours": sla_hours,
            "hours_pending": hours_pending,
        },
    )


def send_submission_pending_background(
    background: BackgroundTasks,
    reviewer_email: str,
    reviewer_name: str,
    operator_name: str,
    location_name: str,
    submission_date: str,
    total_cash: str,
    variance: str,
    variance_exception: bool,
) -> None:
    send_email_background(
        background,
        to=[reviewer_email],
        subject=f"Submission Pending Approval — {location_name} {submission_date}",
        template="submission_pending.html",
        ctx={
            "reviewer_name": reviewer_name,
            "operator_name": operator_name,
            "location_name": location_name,
            "submission_date": submission_date,
            "total_cash": total_cash,
            "variance": variance,
            "variance_exception": variance_exception,
        },
    )


def send_submission_approved_background(
    background: BackgroundTasks,
    operator_email: str,
    operator_name: str,
    location_name: str,
    submission_date: str,
    total_cash: str,
    approved_by_name: str,
) -> None:
    send_email_background(
        background,
        to=[operator_email],
        subject=f"Submission Approved — {location_name} {submission_date}",
        template="submission_approved.html",
        ctx={
            "operator_name": operator_name,
            "location_name": location_name,
            "submission_date": submission_date,
            "total_cash": total_cash,
            "approved_by_name": approved_by_name,
        },
    )


def send_visit_scheduled_background(
    background: BackgroundTasks,
    recipient_email: str,
    recipient_name: str,
    visit_type: str,
    verifier_name: str,
    location_name: str,
    visit_date: str,
    scheduled_time: str | None,
    warning_flag: bool,
) -> None:
    send_email_background(
        background,
        to=[recipient_email],
        subject=f"{visit_type} Visit Scheduled — {location_name} {visit_date}",
        template="visit_scheduled.html",
        ctx={
            "recipient_name": recipient_name,
            "visit_type": visit_type,
            "verifier_name": verifier_name,
            "location_name": location_name,
            "visit_date": visit_date,
            "scheduled_time": scheduled_time,
            "warning_flag": warning_flag,
        },
    )


def send_visit_completed_background(
    background: BackgroundTasks,
    recipient_email: str,
    recipient_name: str,
    visit_type: str,
    verifier_name: str,
    location_name: str,
    visit_date: str,
    observed_total: str,
    notes: str,
) -> None:
    send_email_background(
        background,
        to=[recipient_email],
        subject=f"{visit_type} Visit Completed — {location_name} {visit_date}",
        template="visit_completed.html",
        ctx={
            "recipient_name": recipient_name,
            "visit_type": visit_type,
            "verifier_name": verifier_name,
            "location_name": location_name,
            "visit_date": visit_date,
            "observed_total": observed_total,
            "notes": notes,
        },
    )


def send_missed_explanation_background(
    background: BackgroundTasks,
    controller_email: str,
    controller_name: str,
    operator_name: str,
    location_name: str,
    missed_date: str,
    reason: str,
    detail: str,
    supervisor_name: str,
) -> None:
    send_email_background(
        background,
        to=[controller_email],
        subject=f"Missed Submission Explanation — {location_name} {missed_date}",
        template="missed_explanation.html",
        ctx={
            "controller_name": controller_name,
            "operator_name": operator_name,
            "location_name": location_name,
            "missed_date": missed_date,
            "reason": reason,
            "detail": detail,
            "supervisor_name": supervisor_name,
        },
    )


def send_welcome_background(
    background: BackgroundTasks,
    to: str,
    name: str,
    temp_password: str,
) -> None:
    send_email_background(
        background,
        to=[to],
        subject="Welcome to CashRoom Compass — Your Login Details",
        template="welcome.html",
        ctx={"name": name, "email": to, "temp_password": temp_password},
    )


def send_password_reset_background(
    background: BackgroundTasks,
    to: str,
    name: str,
    otp: str,
) -> None:
    send_email_background(
        background,
        to=[to],
        subject="Your CashRoom Password Reset Code",
        template="password_reset.html",
        ctx={"name": name, "otp": otp},
    )


def send_password_changed_background(
    background: BackgroundTasks,
    to: str,
    name: str,
    reset_at: str,
) -> None:
    send_email_background(
        background,
        to=[to],
        subject="Your CashRoom Password Has Been Reset",
        template="password_changed.html",
        ctx={"name": name, "email": to, "reset_at": reset_at},
    )


def send_submission_rejected_background(
    background: BackgroundTasks,
    operator_email: str,
    operator_name: str,
    location_name: str,
    submission_date: str,
    rejected_by_name: str,
    rejection_reason: str,
) -> None:
    send_email_background(
        background,
        to=[operator_email],
        subject=f"Submission Rejected — {location_name} {submission_date}",
        template="submission_rejected.html",
        ctx={
            "operator_name": operator_name,
            "location_name": location_name,
            "submission_date": submission_date,
            "rejected_by_name": rejected_by_name,
            "rejection_reason": rejection_reason,
        },
    )
