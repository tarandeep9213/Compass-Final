"""add alarm_biannual_checks table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-08 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alarm_biannual_checks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('building_id', sa.String(36), nullable=False, index=True),
        sa.Column('check_type', sa.String(20), nullable=False),
        sa.Column('check_date', sa.String(10), nullable=False),
        sa.Column('next_due_date', sa.String(10), nullable=True),
        sa.Column('checked_by', sa.String(36), nullable=False, server_default=''),
        sa.Column('checked_by_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('days_verified', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('alarm_biannual_checks')
