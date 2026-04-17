"""Seed loc-appleton controller visits for the visit-actions E2E.
Usage:  python _visit_seed.py [seed|clear]
Must be run with backend/ on sys.path.
"""
import sys
import os
import uuid
from datetime import date, timedelta

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")),
)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.verification import Verification, VerificationType, VerificationStatus


def clear(db):
    db.query(Verification).filter(
        Verification.location_id == "loc-appleton",
        Verification.verification_type == VerificationType.CONTROLLER,
    ).delete()
    db.commit()


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "con@compass.com").first()
        if not u:
            print("ERROR: con@compass.com not found", file=sys.stderr)
            sys.exit(1)

        if action == "clear":
            clear(db)
            print("cleared")
            return

        # Seed 3 scheduled visits: next-Monday (future), today, yesterday (past)
        clear(db)
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        future = today + timedelta(days=days_ahead)
        yesterday = today - timedelta(days=1)

        for d in [future, today, yesterday]:
            db.add(
                Verification(
                    id=str(uuid.uuid4()),
                    verification_type=VerificationType.CONTROLLER,
                    location_id="loc-appleton",
                    location_name="Appleton",
                    verifier_id=u.id,
                    verifier_name=u.name,
                    verification_date=d.isoformat(),
                    status=VerificationStatus.SCHEDULED,
                )
            )
        db.commit()
        print(f"seeded future={future} today={today} past={yesterday}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
