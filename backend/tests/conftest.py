"""
Shared test fixtures for all milestones.
Uses a separate test.db SQLite file, seeded with demo users and locations.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.config import SystemConfig
from app.core.security import hash_password

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DEMO_PASSWORD = "demo1234"

SEED_USERS = [
    {"email": "operator@compass.com",   "name": "Alex Operator",   "role": UserRole.OPERATOR,            "location_ids": ["loc-1"]},
    {"email": "controller@compass.com", "name": "Chris Controller", "role": UserRole.CONTROLLER,          "location_ids": ["loc-1", "loc-2", "loc-3"]},
    {"email": "dgm@compass.com",        "name": "Diana DGM",        "role": UserRole.DGM,                 "location_ids": []},
    {"email": "admin@compass.com",      "name": "Adam Admin",       "role": UserRole.ADMIN,               "location_ids": []},
    {"email": "auditor@compass.com",    "name": "Audrey Auditor",   "role": UserRole.AUDITOR,             "location_ids": []},
    {"email": "rc@compass.com",         "name": "Rachel RC",        "role": UserRole.REGIONAL_CONTROLLER, "location_ids": []},
]

SEED_LOCATIONS = [
    {"id": "loc-1", "name": "The Grange Hotel",      "city": "London",   "address": "Grange Road, London"},
    {"id": "loc-2", "name": "Compass HQ Canteen",    "city": "Chertsey", "address": "Compass Centre, Chertsey"},
    {"id": "loc-3", "name": "Euston Station Bistro", "city": "London",   "address": "Euston Station, London"},
    {"id": "loc-4", "name": "Heathrow T2 Outlet",    "city": "Hounslow", "address": "Heathrow Terminal 2"},
    {"id": "loc-5", "name": "Leeds Arena Kitchen",   "city": "Leeds",    "address": "Arena Quarter, Leeds"},
]


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create tables and seed demo data once for the whole test session."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        for u in SEED_USERS:
            if not db.query(User).filter(User.email == u["email"]).first():
                db.add(User(
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    hashed_password=hash_password(DEMO_PASSWORD),
                    location_ids=u["location_ids"],
                    active=True,
                ))
        for l in SEED_LOCATIONS:
            if not db.get(Location, l["id"]):
                db.add(Location(id=l["id"], name=l["name"], city=l["city"], address=l["address"]))
        if not db.get(SystemConfig, 1):
            db.add(SystemConfig(id=1))
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def client(setup_db):
    """FastAPI TestClient wired to the test DB."""
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post("/v1/auth/login", json={"email": "admin@compass.com", "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def operator_token(client):
    r = client.post("/v1/auth/login", json={"email": "operator@compass.com", "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def controller_token(client):
    r = client.post("/v1/auth/login", json={"email": "controller@compass.com", "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return r.json()["access_token"]
