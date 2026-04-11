"""Truncate all application tables (works with any SQLAlchemy-supported DB)."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import engine
from app.db.base import Base

# Import all models so Base.metadata knows every table
import app.models.user            # noqa: F401
import app.models.location        # noqa: F401
import app.models.config          # noqa: F401
import app.models.submission      # noqa: F401
import app.models.verification    # noqa: F401
import app.models.audit           # noqa: F401
import app.models.access_grant    # noqa: F401
import app.models.reasonableness  # noqa: F401
import app.models.alarm           # noqa: F401

with engine.begin() as conn:
    for table in reversed(Base.metadata.sorted_tables):
        conn.execute(table.delete())

print("All tables cleaned")
