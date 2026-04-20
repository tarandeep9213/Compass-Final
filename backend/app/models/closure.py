"""
ClosureRecord — per-location per-date "no count expected" flag.

Different from MissedSubmission (user failed to submit) — a closure is
legitimate absence: the cashroom was closed (holiday, weather, power
outage, etc.) so no count was possible.

Must be Mon-Fri (app-layer validation — weekends are already handled
by the business-day skip logic).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ClosureReason(str, enum.Enum):
    HOLIDAY = "HOLIDAY"
    WEATHER = "WEATHER"
    OTHER = "OTHER"


class ClosureRecord(Base):
    __tablename__ = "closure_records"
    __table_args__ = (
        UniqueConstraint("location_id", "closure_date", name="uq_closure_location_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id: Mapped[str] = mapped_column(String(36), ForeignKey("locations.id"), nullable=False, index=True)
    closure_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    reason: Mapped[ClosureReason] = mapped_column(SAEnum(ClosureReason), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reported_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
