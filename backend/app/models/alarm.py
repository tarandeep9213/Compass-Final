import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AlarmBuilding(Base):
    __tablename__ = "alarm_buildings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    security_company_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    security_customer_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    security_company_phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")  # active, temporarily_exempt, closed
    exempt_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_testers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    assigned_approver: Mapped[str] = mapped_column(String(36), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AlarmZone(Base):
    __tablename__ = "alarm_zones"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    building_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    zone_number: Mapped[int] = mapped_column(Integer, nullable=False)
    zone_name: Mapped[str] = mapped_column(String(200), nullable=False)
    zone_type: Mapped[str] = mapped_column(String(30), nullable=False)  # ENTRY_EXIT, INTERIOR_MOTION, PANIC_SILENT, HOLDUP, FIRE_SMOKE, OTHER
    area_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    other_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
