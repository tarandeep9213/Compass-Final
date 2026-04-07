"""add submitted_by_role to submissions

Revision ID: d1a2b3c4e5f6
Revises: bda23550142c
Create Date: 2026-04-07 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1a2b3c4e5f6'
down_revision: Union[str, None] = 'bda23550142c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('submissions', sa.Column('submitted_by_role', sa.String(20), nullable=False, server_default='OPERATOR'))


def downgrade() -> None:
    op.drop_column('submissions', 'submitted_by_role')
