"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """All configuration is sourced from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",
    )

    # Application
    app_name: str = "AI Website Chaos Tester"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Server
    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")

    # Database
    database_url: str = Field(
        default="postgresql://chaos:chaos@localhost:5432/chaosdb",
        alias="DATABASE_URL",
    )

    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        alias="REDIS_URL",
    )

    # Browser Automation
    headless: bool = Field(default=True, alias="HEADLESS")
    page_timeout_ms: int = Field(default=30000, alias="PAGE_TIMEOUT_MS")
    max_actions_per_run: int = Field(default=200, alias="MAX_ACTIONS_PER_RUN")
    max_crawl_depth: int = Field(default=3, alias="MAX_CRAWL_DEPTH")

    # Safety
    allowed_domains: str = Field(default="", alias="ALLOWED_DOMAINS")
    safe_mode: bool = Field(default=True, alias="SAFE_MODE")

    # AI Provider
    ai_provider: str = Field(default="rules", alias="AI_PROVIDER")

    # Auth: secret used to sign login tokens. If empty, a random secret is
    # generated once and stored in backend/app/db/.auth_secret.
    secret_key: str = Field(default="", alias="SECRET_KEY")

    # Password reset links point here (your deployed frontend URL in production).
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")

    # Outgoing email. Use either Resend (HTTPS API) or SMTP. If neither is
    # configured, reset links are printed in the backend console instead.
    mail_from: str = Field(default="", alias="MAIL_FROM")
    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_starttls: bool = Field(default=True, alias="SMTP_STARTTLS")


# Singleton settings instance
settings = Settings()