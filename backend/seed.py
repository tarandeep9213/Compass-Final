"""
Seed script — creates all 6 demo users for local development.
Run from the backend directory:  python seed.py
"""
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password

DEMO_PASSWORD = "demo1234"

USERS = [
    {
        "email": "operator@compass.com",
        "name": "Alex Operator",
        "role": UserRole.OPERATOR,
        "location_ids": ["loc-1"],
    },
    {
        "email": "controller@compass.com",
        "name": "Chris Controller",
        "role": UserRole.CONTROLLER,
        "location_ids": ["loc-1", "loc-2", "loc-3"],
    },
    {
        "email": "dgm@compass.com",
        "name": "Diana DGM",
        "role": UserRole.DGM,
        "location_ids": [],
    },
    {
        "email": "admin@compass.com",
        "name": "Adam Admin",
        "role": UserRole.ADMIN,
        "location_ids": [],
    },
    {
        "email": "auditor@compass.com",
        "name": "Audrey Auditor",
        "role": UserRole.AUDITOR,
        "location_ids": [],
    },
    {
        "email": "rc@compass.com",
        "name": "Rachel RC",
        "role": UserRole.REGIONAL_CONTROLLER,
        "location_ids": [],
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        created = 0
        skipped = 0
        for u in USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                skipped += 1
                print(f"  skip  {u['email']} (already exists)")
                continue
            user = User(
                email=u["email"],
                name=u["name"],
                role=u["role"],
                hashed_password=hash_password(DEMO_PASSWORD),
                location_ids=u["location_ids"],
                active=True,
            )
            db.add(user)
            created += 1
            print(f"  create {u['email']}  role={u['role'].value}")
        db.commit()
        print(f"\nDone — {created} created, {skipped} skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
