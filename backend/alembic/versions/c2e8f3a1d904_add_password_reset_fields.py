"""add_password_reset_fields

Revision ID: c2e8f3a1d904
Revises: 537d31465f1c
Create Date: 2026-03-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2e8f3a1d904'
down_revision: Union[str, None] = '537d31465f1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=200), nullable=True))
    op.add_column('users', sa.Column('password_reset_expires', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_reset_expires')
    op.drop_column('users', 'password_reset_token')
