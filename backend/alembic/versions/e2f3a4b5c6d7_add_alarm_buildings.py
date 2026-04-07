"""add alarm_buildings table

Revision ID: e2f3a4b5c6d7
Revises: d1a2b3c4e5f6
Create Date: 2026-04-08 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1a2b3c4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alarm_buildings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('region', sa.String(100), nullable=False, server_default=''),
        sa.Column('security_company_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('security_customer_id', sa.String(100), nullable=False, server_default=''),
        sa.Column('security_company_phone', sa.String(50), nullable=False, server_default=''),
        sa.Column('status', sa.String(30), nullable=False, server_default='active'),
        sa.Column('exempt_reason', sa.Text(), nullable=True),
        sa.Column('assigned_testers', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('assigned_approver', sa.String(36), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('alarm_buildings')
