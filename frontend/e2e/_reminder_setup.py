"""Setup / teardown for the visit-reminder E2E.

Promotes two real mailboxes to test roles, clears conflicting visits,
and on teardown restores their original roles.

Usage:
    python _reminder_setup.py setup
    python _reminder_setup.py trigger_reminder
    python _reminder_setup.py teardown
"""
import sys
import os
import json

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")),
)

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.verification import Verification, VerificationType, VerificationStatus

CONTROLLER_EMAIL = "rahuls18@damcogroup.com"
DGM_EMAIL = "rahulairesearcher@gmail.com"
LOCATION = "loc-appleton"

STATE_PATH = os.path.join(os.path.dirname(__file__), "_reminder_state.json")


def _get_user(db, email):
    return db.query(User).filter(User.email == email).first()


def setup():
    db = SessionLocal()
    try:
        c = _get_user(db, CONTROLLER_EMAIL)
        d = _get_user(db, DGM_EMAIL)
        if not c:
            print(f"ERROR: {CONTROLLER_EMAIL} not found", file=sys.stderr)
            sys.exit(1)
        if not d:
            print(f"ERROR: {DGM_EMAIL} not found", file=sys.stderr)
            sys.exit(1)

        # Save original state
        state = {
            "controller": {"role": c.role.value, "locations": list(c.location_ids or [])},
            "dgm": {"role": d.role.value, "locations": list(d.location_ids or [])},
        }
        with open(STATE_PATH, "w") as f:
            json.dump(state, f)
        print(f"saved original state: {state}")

        # Promote
        c.role = UserRole.CONTROLLER
        c.location_ids = [LOCATION]
        d.role = UserRole.DGM
        d.location_ids = [LOCATION]

        # Clear all visits at the location (this week/month) to avoid conflicts
        deleted = db.query(Verification).filter(
            Verification.location_id == LOCATION,
        ).delete()
        db.commit()
        print(f"promoted roles, cleared {deleted} prior visits at {LOCATION}")
    finally:
        db.close()


def trigger_reminder():
    from app.services.scheduler import job_visit_reminder
    job_visit_reminder()
    print("job_visit_reminder() executed")


def teardown():
    if not os.path.exists(STATE_PATH):
        print("no saved state; skipping role restore")
        return

    with open(STATE_PATH) as f:
        state = json.load(f)

    db = SessionLocal()
    try:
        c = _get_user(db, CONTROLLER_EMAIL)
        d = _get_user(db, DGM_EMAIL)
        if c:
            c.role = UserRole(state["controller"]["role"])
            c.location_ids = state["controller"]["locations"]
        if d:
            d.role = UserRole(state["dgm"]["role"])
            d.location_ids = state["dgm"]["locations"]

        # Clean test visits
        db.query(Verification).filter(
            Verification.location_id == LOCATION,
        ).delete()
        db.commit()
        print(f"restored roles and cleared test visits at {LOCATION}")
    finally:
        db.close()
        try:
            os.remove(STATE_PATH)
        except OSError:
            pass


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "setup"
    if action == "setup":
        setup()
    elif action == "trigger_reminder":
        trigger_reminder()
    elif action == "teardown":
        teardown()
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)
