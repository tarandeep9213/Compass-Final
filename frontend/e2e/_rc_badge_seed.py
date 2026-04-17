"""Seed multi-role submissions for loc-appleton on today's date.
Usage:
    python _rc_badge_seed.py seed      # insert OPERATOR, CONTROLLER, DGM subs
    python _rc_badge_seed.py clear     # remove seed-* submissions for today
"""
import sys
import os
import uuid
from datetime import date, datetime, timezone

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")),
)

from app.db.session import SessionLocal
from app.models.submission import Submission, SubmissionStatus, SubmissionSource


def seed():
    db = SessionLocal()
    try:
        today = date.today().isoformat()

        # Clean any prior submissions for loc-appleton today (both seed and real)
        db.query(Submission).filter(
            Submission.location_id == "loc-appleton",
            Submission.submission_date == today,
        ).delete()
        db.commit()

        seeds = [
            ("OPERATOR", SubmissionStatus.PENDING_APPROVAL),
            ("CONTROLLER", SubmissionStatus.APPROVED),
            ("DGM", SubmissionStatus.APPROVED),
        ]
        for role, status in seeds:
            db.add(
                Submission(
                    id=str(uuid.uuid4()),
                    location_id="loc-appleton",
                    location_name="APPLETON",
                    operator_id=f"seed-{role}",
                    operator_name=f"{role} Seeded",
                    submission_date=today,
                    status=status,
                    source=SubmissionSource.FORM,
                    sections={"A": 1000},
                    total_cash=9575,
                    expected_cash=9575,
                    variance=0,
                    variance_pct=0,
                    submitted_by_role=role,
                    submitted_at=datetime.now(timezone.utc),
                )
            )
        db.commit()
        print("seeded OP, CTRL, DGM submissions for loc-appleton")
    finally:
        db.close()


def clear():
    db = SessionLocal()
    try:
        today = date.today().isoformat()
        deleted = (
            db.query(Submission)
            .filter(
                Submission.location_id == "loc-appleton",
                Submission.submission_date == today,
            )
            .delete()
        )
        db.commit()
        print(f"cleared {deleted} submissions")
    finally:
        db.close()


def clear_wausau_rc():
    db = SessionLocal()
    try:
        today = date.today().isoformat()
        deleted = (
            db.query(Submission)
            .filter(
                Submission.location_id == "loc-wausau",
                Submission.submission_date == today,
                Submission.submitted_by_role == "REGIONAL_CONTROLLER",
            )
            .delete()
        )
        db.commit()
        print(f"cleared {deleted} RC wausau submissions")
    finally:
        db.close()


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if action == "seed":
        seed()
    elif action == "clear":
        clear()
    elif action == "clear_wausau_rc":
        clear_wausau_rc()
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)
