import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cost_center: Mapped[str | None] = mapped_column(String(50), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="")

    # Default tolerance from global config; may be overridden per location
    tolerance_pct_override: Mapped[float | None] = mapped_column(Float, nullable=True)

    expected_cash: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sla_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
