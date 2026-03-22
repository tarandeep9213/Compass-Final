from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CashRoom Compliance System"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./cashroom.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-use-a-256-bit-random-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_STARTTLS: bool = False
    SMTP_SSL_TLS: bool = False
    FROM_EMAIL: str = "noreply@compass.com"
    FROM_NAME: str = "CashRoom Compass"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [s.strip() for s in v.split(",")]
        return v

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
