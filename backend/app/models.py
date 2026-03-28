import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ScanType(str, enum.Enum):
    SSL = "ssl"
    DNS = "dns"
    SPF_DKIM = "spf_dkim"
    HEADERS = "headers"
    PORTS = "ports"


class SeverityType(str, enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    PASS = "pass"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    supabase_uid: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    domains: Mapped[list["Domain"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    domain_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="domains")
    scan_results: Mapped[list["ScanResult"]] = relationship(back_populates="domain", cascade="all, delete-orphan")
    security_scores: Mapped[list["SecurityScore"]] = relationship(back_populates="domain", cascade="all, delete-orphan")
    crisis_events: Mapped[list["CrisisEvent"]] = relationship(back_populates="domain", cascade="all, delete-orphan")


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    scan_type: Mapped[ScanType] = mapped_column(
        Enum(ScanType, name="scan_type_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    severity: Mapped[SeverityType] = mapped_column(
        Enum(SeverityType, name="severity_type_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    domain: Mapped["Domain"] = relationship(back_populates="scan_results")


class SecurityScore(Base):
    __tablename__ = "security_scores"
    __table_args__ = (
        CheckConstraint("total_score >= 0 AND total_score <= 100", name="ck_total_score_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    ssl_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    email_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    headers_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dns_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ports_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    domain: Mapped["Domain"] = relationship(back_populates="security_scores")


class CrisisEvent(Base):
    __tablename__ = "crisis_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    domain: Mapped["Domain"] = relationship(back_populates="crisis_events")
