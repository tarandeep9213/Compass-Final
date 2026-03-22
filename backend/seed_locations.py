"""
Seed demo locations matching the frontend mock data IDs.
Run: python seed_locations.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.location import Location
from app.models.config import SystemConfig

LOCATIONS = [
    {"id": "loc-1", "name": "The Grange Hotel",       "city": "London",     "address": "Grange Road, London"},
    {"id": "loc-2", "name": "Compass HQ Canteen",     "city": "Chertsey",   "address": "Compass Centre, Chertsey"},
    {"id": "loc-3", "name": "Euston Station Bistro",  "city": "London",     "address": "Euston Station, London"},
    {"id": "loc-4", "name": "Heathrow T2 Outlet",     "city": "Hounslow",   "address": "Heathrow Terminal 2"},
    {"id": "loc-5", "name": "Leeds Arena Kitchen",    "city": "Leeds",      "address": "Arena Quarter, Leeds"},
]

def seed():
    db = SessionLocal()
    try:
        created = skipped = 0
        for l in LOCATIONS:
            if db.get(Location, l["id"]):
                skipped += 1
                print(f"  skip  {l['id']} {l['name']}")
                continue
            db.add(Location(id=l["id"], name=l["name"], city=l["city"], address=l["address"]))
            created += 1
            print(f"  create {l['id']} {l['name']}")

        # Ensure system config row exists
        if not db.get(SystemConfig, 1):
            db.add(SystemConfig(id=1))
            print("  create system_config row")

        db.commit()
        print(f"\nDone — {created} created, {skipped} skipped.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
