import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)

    actor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    actor_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    actor_role: Mapped[str] = mapped_column(String(30), nullable=False, default="")

    location_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True)

    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_audit_created_at", "created_at"),
    )
