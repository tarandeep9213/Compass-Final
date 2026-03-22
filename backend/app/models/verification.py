import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Float, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class VerificationStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    MISSED    = "missed"
    CANCELLED = "cancelled"


class VerificationType(str, enum.Enum):
    CONTROLLER = "CONTROLLER"
    DGM        = "DGM"


class Verification(Base):
    __tablename__ = "verifications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    verification_type: Mapped[VerificationType] = mapped_column(
        SAEnum(VerificationType), nullable=False, index=True
    )
    location_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    location_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    verifier_id: Mapped[str] = mapped_column(String(36), nullable=False)
    verifier_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    verification_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    scheduled_time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # HH:MM
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, default=0)   # 0=Mon
    day_name: Mapped[str] = mapped_column(String(10), nullable=False, default="")

    status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus), default=VerificationStatus.SCHEDULED, nullable=False, index=True
    )

    # DOW pattern warning
    warning_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    warning_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Completion fields
    observed_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    variance_vs_imprest: Mapped[float | None] = mapped_column(Float, nullable=True)
    variance_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    missed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DGM specific: month coverage tracking
    month_year: Mapped[str | None] = mapped_column(String(7), nullable=True)  # YYYY-MM

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
