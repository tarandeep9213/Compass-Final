"""add ALARM_TESTER, ALARM_APPROVER, ALARM_ADMIN to UserRole enum

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


NEW_VALUES = ("ALARM_TESTER", "ALARM_APPROVER", "ALARM_ADMIN")


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # PostgreSQL: ALTER TYPE to add enum values (must be outside transaction)
        # Use IF NOT EXISTS to make this idempotent
        for v in NEW_VALUES:
            op.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{v}'")
    # SQLite: enum values are stored as VARCHAR — no schema change needed.
    # The Python enum class handles validation at the application level.


def downgrade():
    # Removing enum values from PostgreSQL requires recreating the type.
    # For safety, leave new values in place. They are harmless if unused.
    pass
