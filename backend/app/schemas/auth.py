from pydantic import BaseModel, field_serializer
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    location_ids: list[str]
    access_grants: list[str]
    active: bool

    model_config = {"from_attributes": True}

    @field_serializer("role")
    def serialize_role(self, role: UserRole) -> str:
        return role.value  # return uppercase to match frontend ApiRole type


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int   # seconds
    user: AuthUser


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
