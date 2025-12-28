"""Drop legacy op_type from operation

Revision ID: 4d3a1e2f9abc
Revises: 8e2b4f0c6d8b
Create Date: 2025-09-12 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4d3a1e2f9abc'
down_revision = '8e2b4f0c6d8b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('operation') as batch_op:
        batch_op.drop_column('op_type')


def downgrade():
    with op.batch_alter_table('operation') as batch_op:
        batch_op.add_column(sa.Column('op_type', sa.String(length=10), nullable=False, server_default='pending'))
    # remove server default after creating to avoid locking in future
    with op.batch_alter_table('operation') as batch_op:
        batch_op.alter_column('op_type', server_default=None)

