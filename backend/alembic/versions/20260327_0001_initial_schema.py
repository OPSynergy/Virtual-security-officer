"""initial schema

Revision ID: 20260327_0001
Revises:
Create Date: 2026-03-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    scan_type_enum = postgresql.ENUM(
        "ssl", "dns", "spf_dkim", "headers", "ports", name="scan_type_enum", create_type=False
    )
    severity_type_enum = postgresql.ENUM(
        "critical", "warning", "info", "pass", name="severity_type_enum", create_type=False
    )
    scan_type_enum.create(op.get_bind(), checkfirst=True)
    severity_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("supabase_uid", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("supabase_uid"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.create_index("ix_users_supabase_uid", "users", ["supabase_uid"], unique=False)

    op.create_table(
        "domains",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_domains_user_id", "domains", ["user_id"], unique=False)
    op.create_index("ix_domains_domain_name", "domains", ["domain_name"], unique=False)

    op.create_table(
        "scan_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_type", scan_type_enum, nullable=False),
        sa.Column("severity", severity_type_enum, nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["domain_id"], ["domains.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_results_domain_id", "scan_results", ["domain_id"], unique=False)

    op.create_table(
        "security_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("ssl_score", sa.Integer(), nullable=False),
        sa.Column("email_score", sa.Integer(), nullable=False),
        sa.Column("headers_score", sa.Integer(), nullable=False),
        sa.Column("dns_score", sa.Integer(), nullable=False),
        sa.Column("ports_score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("total_score >= 0 AND total_score <= 100", name="ck_total_score_range"),
        sa.ForeignKeyConstraint(["domain_id"], ["domains.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_security_scores_domain_id", "security_scores", ["domain_id"], unique=False)

    op.create_table(
        "crisis_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("resolved", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["domain_id"], ["domains.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crisis_events_domain_id", "crisis_events", ["domain_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_crisis_events_domain_id", table_name="crisis_events")
    op.drop_table("crisis_events")

    op.drop_index("ix_security_scores_domain_id", table_name="security_scores")
    op.drop_table("security_scores")

    op.drop_index("ix_scan_results_domain_id", table_name="scan_results")
    op.drop_table("scan_results")

    op.drop_index("ix_domains_domain_name", table_name="domains")
    op.drop_index("ix_domains_user_id", table_name="domains")
    op.drop_table("domains")

    op.drop_index("ix_users_supabase_uid", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS severity_type_enum")
    op.execute("DROP TYPE IF EXISTS scan_type_enum")
