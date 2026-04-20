"""add closure_records

Revision ID: d2e3f4a5b6c7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-20 16:00:00.000000

Additive — new table only. Does not touch any existing data.
Chains off the Issue #3 scheduler_timezone migration — wait, that one
was dropped. This chains off c9d0e1f2a3b4 (add_alarm_user_roles), the
actual head before our fix branch.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "closure_records",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("location_id", sa.String(length=36), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("closure_date", sa.String(length=10), nullable=False),
        sa.Column(
            "reason",
            sa.Enum("HOLIDAY", "WEATHER", "OTHER", name="closurereason"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("reported_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("location_id", "closure_date", name="uq_closure_location_date"),
    )
    op.create_index("ix_closure_records_location_id", "closure_records", ["location_id"])
    op.create_index("ix_closure_records_closure_date", "closure_records", ["closure_date"])


def downgrade() -> None:
    op.drop_index("ix_closure_records_closure_date", table_name="closure_records")
    op.drop_index("ix_closure_records_location_id", table_name="closure_records")
    op.drop_table("closure_records")
    # Drop the enum type (Postgres only; SQLite ignores it)
    sa.Enum(name="closurereason").drop(op.get_bind(), checkfirst=True)
