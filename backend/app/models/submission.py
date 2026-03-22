import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Float, JSON, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SubmissionStatus(str, enum.Enum):
    DRAFT            = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED         = "approved"
    REJECTED         = "rejected"


class SubmissionSource(str, enum.Enum):
    FORM  = "FORM"
    CHAT  = "CHAT"
    EXCEL = "EXCEL"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    location_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    location_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    operator_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    operator_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    submission_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    status: Mapped[SubmissionStatus] = mapped_column(
        SAEnum(SubmissionStatus), default=SubmissionStatus.DRAFT, nullable=False, index=True
    )
    source: Mapped[SubmissionSource] = mapped_column(
        SAEnum(SubmissionSource), default=SubmissionSource.FORM, nullable=False
    )

    # Section data: JSON dict keyed A–I, each with {total, denominations}
    sections: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    total_cash: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    expected_cash: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    variance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    variance_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    variance_exception: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    variance_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Approval fields
    approved_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    approved_by_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class MissedSubmission(Base):
    __tablename__ = "missed_submissions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    location_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    missed_date: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    supervisor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    logged_by: Mapped[str] = mapped_column(String(36), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
