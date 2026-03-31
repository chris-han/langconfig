"""add provider_configs to settings

Revision ID: 015_add_provider_configs_to_settings
Revises: 014_add_azure_embedding_settings
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa


revision = "015_add_provider_configs_to_settings"
down_revision = "014_add_azure_embedding_settings"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def upgrade() -> None:
    if not _column_exists("settings", "provider_configs"):
        op.add_column("settings", sa.Column("provider_configs", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("settings", "provider_configs"):
        op.drop_column("settings", "provider_configs")
