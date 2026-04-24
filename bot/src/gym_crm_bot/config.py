from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="gym-crm-bot", alias="BOT_APP_NAME")
    environment: str = Field(default="development", alias="BOT_ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="BOT_LOG_LEVEL")

    http_host: str = Field(default="0.0.0.0", alias="BOT_HTTP_HOST")
    http_port: int = Field(default=8080, alias="BOT_HTTP_PORT")

    database_url: str = Field(alias="BOT_DATABASE_URL")
    database_echo: bool = Field(default=False, alias="BOT_DATABASE_ECHO")

    telegram_token: SecretStr = Field(
        validation_alias=AliasChoices("BOT_TELEGRAM_TOKEN", "TELEGRAM_BOT_TOKEN"),
    )
    bot_mode: str = Field(default="LongPolling", alias="BOT_MODE")

    crm_base_url: str = Field(
        validation_alias=AliasChoices("CRM_API_BASE_URL", "BOT_CRM_BASE_URL"),
    )
    crm_service_token: SecretStr = Field(
        validation_alias=AliasChoices("CRM_BOT_API_TOKEN", "BOT_CRM_SERVICE_TOKEN"),
    )
    crm_timeout_seconds: float = Field(default=10.0, alias="BOT_CRM_TIMEOUT_SECONDS")
    crm_read_retry_attempts: int = Field(default=2, alias="BOT_CRM_READ_RETRY_ATTEMPTS")
    crm_read_retry_backoff_seconds: float = Field(
        default=0.25,
        alias="BOT_CRM_READ_RETRY_BACKOFF_SECONDS",
    )

    conversation_state_ttl_hours: int = Field(default=24, alias="BOT_STATE_TTL_HOURS")

    @field_validator("crm_base_url")
    @classmethod
    def normalize_crm_base_url(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator("bot_mode")
    @classmethod
    def validate_bot_mode(cls, value: str) -> str:
        if value != "LongPolling":
            msg = "Only LongPolling mode is supported in MVP."
            raise ValueError(msg)
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
