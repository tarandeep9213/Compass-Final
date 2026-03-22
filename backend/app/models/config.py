"""
Global system config stored as a single row (id=1).
Location tolerance overrides stored as separate rows.
"""
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    default_tolerance_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    approval_sla_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    dow_lookback_weeks: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    daily_reminder_time: Mapped[str] = mapped_column(String(5), default="08:00", nullable=False)
    data_retention_years: Mapped[int] = mapped_column(Integer, default=7, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class LocationToleranceOverride(Base):
    __tablename__ = "location_tolerance_overrides"

    location_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tolerance_pct: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
