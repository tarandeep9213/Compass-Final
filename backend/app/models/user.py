import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, enum.Enum):
    OPERATOR            = "OPERATOR"
    CONTROLLER          = "CONTROLLER"
    DGM                 = "DGM"
    ADMIN               = "ADMIN"
    AUDITOR             = "AUDITOR"
    REGIONAL_CONTROLLER = "REGIONAL_CONTROLLER"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(
        String(200), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)

    # JSON list of location IDs this user is assigned to
    location_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # JSON list of extra access grants: ['operator', 'controller']
    access_grants: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    password_reset_token: Mapped[str | None] = mapped_column(String(200), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
