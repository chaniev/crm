"""create bot tables

Revision ID: 202604241820
Revises:
Create Date: 2026-04-24 18:20:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "202604241820"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bot_conversation_states",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column("chat_id", sa.BigInteger(), nullable=False),
        sa.Column("platform_user_id", sa.String(length=128), nullable=False),
        sa.Column("scenario", sa.String(length=64), nullable=False),
        sa.Column("state_json", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "platform",
            "chat_id",
            "platform_user_id",
            "scenario",
            name="uq_bot_conversation_states_scope",
        ),
    )

    op.create_table(
        "bot_processed_updates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column("update_id", sa.BigInteger(), nullable=False),
        sa.Column("event_key", sa.String(length=256), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "platform",
            "update_id",
            name="uq_bot_processed_updates_platform_update",
        ),
    )

    op.create_index(
        "ix_bot_processed_updates_processed_at",
        "bot_processed_updates",
        ["processed_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bot_processed_updates_processed_at", table_name="bot_processed_updates")
    op.drop_table("bot_processed_updates")
    op.drop_table("bot_conversation_states")
