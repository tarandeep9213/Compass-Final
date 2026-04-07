"""add alarm_tests and alarm_test_zones tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-08 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alarm_tests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('building_id', sa.String(36), nullable=False, index=True),
        sa.Column('test_date', sa.String(10), nullable=False),
        sa.Column('test_month', sa.String(7), nullable=False, index=True),
        sa.Column('tester_id', sa.String(36), nullable=False),
        sa.Column('tester_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT'),
        sa.Column('test_start_time', sa.String(10), nullable=True),
        sa.Column('test_end_time', sa.String(10), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('zones_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('zones_tested', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('zones_issue', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('submitted_at', sa.String(30), nullable=True),
        sa.Column('approved_by', sa.String(36), nullable=True),
        sa.Column('approved_by_name', sa.String(200), nullable=True),
        sa.Column('approved_at', sa.String(30), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table('alarm_test_zones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('alarm_test_id', sa.String(36), nullable=False, index=True),
        sa.Column('alarm_zone_id', sa.String(36), nullable=False),
        sa.Column('result', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('alarm_test_zones')
    op.drop_table('alarm_tests')
