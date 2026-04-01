import uuid
import enum
from datetime import date, datetime, timezone

from sqlalchemy import String, Float, Date, DateTime, Text, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ReasonablenessStatus(str, enum.Enum):
    REASONABLE = "Reasonable"
    OVERFUNDED = "Overfunded"


class ReasonablenessReport(Base):
    __tablename__ = "reasonableness_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    group_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    cost_center: Mapped[str] = mapped_column(String(50), nullable=False)
    location_labels: Mapped[str] = mapped_column(String(500), nullable=False)

    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    factor: Mapped[float] = mapped_column(Float, nullable=False)

    preparer: Mapped[str] = mapped_column(String(200), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[ReasonablenessStatus] = mapped_column(
        SAEnum(ReasonablenessStatus), nullable=False, index=True
    )
    location_reports: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    saved_by: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
