"""add alarm_audit_events table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-08 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alarm_audit_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('category', sa.String(20), nullable=False, index=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('user_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('details', sa.Text(), nullable=False, server_default=''),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table('alarm_audit_events')
