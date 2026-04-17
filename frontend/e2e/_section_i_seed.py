"""Seed/clear helper for Section I carry-forward E2E.

Creates operator submissions on chosen in-month dates with given Section I
values so the prior-section-i endpoint has something to carry forward.

Usage:
    python _section_i_seed.py seed_prior <YYYY-MM-DD> <I-ending>
    python _section_i_seed.py clear
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
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus, SubmissionSource

LOCATION = "loc-appleton"
OPERATOR_EMAIL = "op@compass.com"


def seed_prior(date_str: str, i_ending: float):
    db = SessionLocal()
    try:
        op = db.query(User).filter(User.email == OPERATOR_EMAIL).first()
        if not op:
            # Fall back to first OPERATOR user
            from app.models.user import UserRole
            op = db.query(User).filter(User.role == UserRole.OPERATOR).first()
        if not op:
            print("ERROR: no operator user found", file=sys.stderr)
            sys.exit(1)

        # Ensure operator is assigned to LOCATION
        if LOCATION not in (op.location_ids or []):
            op.location_ids = list(op.location_ids or []) + [LOCATION]

        db.query(Submission).filter(
            Submission.location_id == LOCATION,
            Submission.submission_date == date_str,
        ).delete()
        db.commit()

        # Section I stored as dict with total/yesterday/today
        db.add(
            Submission(
                id=str(uuid.uuid4()),
                location_id=LOCATION,
                location_name="APPLETON",
                operator_id=op.id,
                operator_name=op.name,
                submission_date=date_str,
                status=SubmissionStatus.PENDING_APPROVAL,
                source=SubmissionSource.FORM,
                sections={
                    "A": {"total": 1000},
                    "I": {"total": i_ending, "yesterday": 0, "today": i_ending},
                },
                total_cash=9575,
                expected_cash=9575,
                variance=0,
                variance_pct=0,
                submitted_by_role="OPERATOR",
                submitted_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        print(f"seeded prior operator submission on {date_str} with Section I ending {i_ending}")
    finally:
        db.close()


def clear():
    db = SessionLocal()
    try:
        today = date.today().isoformat()
        month = today[:7]
        deleted = (
            db.query(Submission)
            .filter(
                Submission.location_id == LOCATION,
                Submission.submission_date.like(f"{month}-%"),
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"cleared {deleted} submissions for {LOCATION} in {month}")
    finally:
        db.close()


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed_prior"
    if action == "seed_prior":
        seed_prior(sys.argv[2], float(sys.argv[3]))
    elif action == "clear":
        clear()
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)
