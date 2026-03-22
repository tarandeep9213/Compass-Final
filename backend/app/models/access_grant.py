import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AccessGrant(Base):
    __tablename__ = "access_grants"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    user_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    user_role: Mapped[str] = mapped_column(String(30), nullable=False, default="")

    access_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'operator' | 'controller'
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    granted_by: Mapped[str] = mapped_column(String(36), nullable=False)
    granted_by_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
