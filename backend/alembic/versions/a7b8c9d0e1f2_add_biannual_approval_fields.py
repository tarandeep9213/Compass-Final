"""add approval fields to alarm_biannual_checks

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-08 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('alarm_biannual_checks', sa.Column('approval_status', sa.String(20), nullable=False, server_default='DRAFT'))
    op.add_column('alarm_biannual_checks', sa.Column('submitted_at', sa.String(30), nullable=True))
    op.add_column('alarm_biannual_checks', sa.Column('approved_by', sa.String(36), nullable=True))
    op.add_column('alarm_biannual_checks', sa.Column('approved_by_name', sa.String(200), nullable=True))
    op.add_column('alarm_biannual_checks', sa.Column('approved_at', sa.String(30), nullable=True))
    op.add_column('alarm_biannual_checks', sa.Column('rejection_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('alarm_biannual_checks', 'rejection_reason')
    op.drop_column('alarm_biannual_checks', 'approved_at')
    op.drop_column('alarm_biannual_checks', 'approved_by_name')
    op.drop_column('alarm_biannual_checks', 'approved_by')
    op.drop_column('alarm_biannual_checks', 'submitted_at')
    op.drop_column('alarm_biannual_checks', 'approval_status')
