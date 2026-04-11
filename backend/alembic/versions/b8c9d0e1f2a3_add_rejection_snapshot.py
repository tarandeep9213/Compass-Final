"""add rejection_snapshot to submissions

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("rejection_snapshot", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "rejection_snapshot")
