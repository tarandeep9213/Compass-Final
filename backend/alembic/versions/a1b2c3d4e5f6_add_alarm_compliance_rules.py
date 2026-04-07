"""add alarm_compliance_rules table

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-04-08 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alarm_compliance_rules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('monthly_deadline_day', sa.Integer(), nullable=False, server_default='28'),
        sa.Column('approval_sla_days', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('require_all_zones_tested', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('require_report_upload', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('require_approver_signoff', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('escalation', sa.JSON(), nullable=False),
        sa.Column('biannual', sa.JSON(), nullable=False),
        sa.Column('notifications', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('alarm_compliance_rules')
