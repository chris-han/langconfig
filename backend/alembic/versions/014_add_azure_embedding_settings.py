# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""add azure embedding settings fields to settings table

Revision ID: 014_azure_embedding_settings
Revises: 013_workflow_triggers
Create Date: 2026-03-31 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "014_azure_embedding_settings"
down_revision = "013_workflow_triggers"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table_name
                AND column_name = :column_name
            )
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return bool(result.scalar())


def upgrade() -> None:
    if not _column_exists("settings", "azure_openai_endpoint"):
        op.add_column("settings", sa.Column("azure_openai_endpoint", sa.String(), nullable=True))

    if not _column_exists("settings", "azure_openai_api_version"):
        op.add_column(
            "settings",
            sa.Column(
                "azure_openai_api_version",
                sa.String(),
                nullable=True,
                server_default="2024-05-01-preview",
            ),
        )

    if not _column_exists("settings", "azure_openai_embedding_deployment"):
        op.add_column("settings", sa.Column("azure_openai_embedding_deployment", sa.String(), nullable=True))

    if not _column_exists("settings", "azure_openai_embedding_dimensions"):
        op.add_column("settings", sa.Column("azure_openai_embedding_dimensions", sa.Integer(), nullable=True))


def downgrade() -> None:
    if _column_exists("settings", "azure_openai_embedding_dimensions"):
        op.drop_column("settings", "azure_openai_embedding_dimensions")

    if _column_exists("settings", "azure_openai_embedding_deployment"):
        op.drop_column("settings", "azure_openai_embedding_deployment")

    if _column_exists("settings", "azure_openai_api_version"):
        op.drop_column("settings", "azure_openai_api_version")

    if _column_exists("settings", "azure_openai_endpoint"):
        op.drop_column("settings", "azure_openai_endpoint")
