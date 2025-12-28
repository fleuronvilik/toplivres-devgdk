"""Add type and status columns and backfill from op_type

Revision ID: 8e2b4f0c6d8b
Revises: 419e2c1be18c
Create Date: 2025-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8e2b4f0c6d8b'
down_revision = '419e2c1be18c'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns with conservative defaults
    op.add_column('operation', sa.Column('type', sa.String(length=10), nullable=False, server_default='order'))
    op.add_column('operation', sa.Column('status', sa.String(length=12), nullable=True))

    # Backfill from existing op_type
    conn = op.get_bind()
    # Map pending/delivered/cancelled -> order + same status
    conn.execute(sa.text("""
        UPDATE operation SET type='order', status=op_type
        WHERE op_type IN ('pending','delivered','cancelled')
    """))
    # Map report -> report + recorded
    conn.execute(sa.text("""
        UPDATE operation SET type='report', status='recorded'
        WHERE op_type = 'report'
    """))

    # Drop server default for type now that rows are backfilled, keep non-null constraint
    with op.batch_alter_table('operation') as batch_op:
        batch_op.alter_column('type', server_default=None)


def downgrade():
    # Remove columns (data loss on type/status)
    with op.batch_alter_table('operation') as batch_op:
        batch_op.drop_column('status')
        batch_op.drop_column('type')

