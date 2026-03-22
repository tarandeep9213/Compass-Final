from pydantic import BaseModel, field_serializer
from typing import Optional
from app.models.user import UserRole


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    location_ids: list[str]
    active: bool
    created_at: str

    model_config = {"from_attributes": True}

    @field_serializer("role")
    def serialize_role(self, role: UserRole) -> str:
        return role.value  # uppercase to match frontend ApiRole


class CreateUserBody(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole
    location_ids: list[str] = []


class UpdateUserBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    location_ids: Optional[list[str]] = None
    active: Optional[bool] = None
