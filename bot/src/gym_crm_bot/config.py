from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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
    telegram_proxy_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "BOT_TELEGRAM_PROXY_URL",
            "HTTPS_PROXY",
            "HTTP_PROXY",
            "https_proxy",
            "http_proxy",
        ),
    )
    telegram_mtproxy_urls: Annotated[tuple[str, ...], NoDecode] = Field(
        default_factory=tuple,
        validation_alias=AliasChoices("BOT_TELEGRAM_MTPROXY_URLS", "BOT_TELEGRAM_MTPROXY_URL"),
    )
    telegram_api_id: int | None = Field(
        default=None,
        validation_alias=AliasChoices("BOT_TELEGRAM_API_ID", "TELEGRAM_API_ID"),
    )
    telegram_api_hash: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("BOT_TELEGRAM_API_HASH", "TELEGRAM_API_HASH"),
    )
    telegram_mtproto_session_path: str = Field(
        default="/app/data/bot/telegram-mtproto",
        alias="BOT_TELEGRAM_MTPROTO_SESSION_PATH",
    )
    telegram_proxy_failover_delay_seconds: float = Field(
        default=5.0,
        alias="BOT_TELEGRAM_PROXY_FAILOVER_DELAY_SECONDS",
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

    @field_validator("telegram_proxy_url", mode="before")
    @classmethod
    def normalize_optional_proxy_url(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("telegram_api_id", "telegram_api_hash", mode="before")
    @classmethod
    def normalize_optional_telegram_api_credentials(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("telegram_mtproxy_urls", mode="before")
    @classmethod
    def normalize_optional_proxy_urls(cls, value: object) -> object:
        if value is None:
            return ()
        if isinstance(value, str):
            raw_items = value.replace("\n", ",").replace(";", ",").split(",")
            return tuple(item.strip() for item in raw_items if item.strip())
        if isinstance(value, list | tuple):
            return tuple(str(item).strip() for item in value if str(item).strip())
        return value

    @field_validator("bot_mode")
    @classmethod
    def validate_bot_mode(cls, value: str) -> str:
        if value != "LongPolling":
            msg = "Only LongPolling mode is supported in MVP."
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def validate_mtproxy_settings(self) -> Settings:
        if not self.telegram_mtproxy_urls:
            return self
        if self.telegram_api_id is None or self.telegram_api_hash is None:
            msg = (
                "BOT_TELEGRAM_API_ID and BOT_TELEGRAM_API_HASH are required when "
                "BOT_TELEGRAM_MTPROXY_URLS is configured."
            )
            raise ValueError(msg)
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
