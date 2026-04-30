from __future__ import annotations

import pytest

from gym_crm_bot.config import Settings


@pytest.fixture(autouse=True)
def clean_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in [
        "BOT_DATABASE_URL",
        "BOT_TELEGRAM_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "BOT_TELEGRAM_PROXY_URL",
        "BOT_TELEGRAM_MTPROXY_URL",
        "BOT_TELEGRAM_MTPROXY_URLS",
        "BOT_TELEGRAM_API_ID",
        "BOT_TELEGRAM_API_HASH",
        "TELEGRAM_API_ID",
        "TELEGRAM_API_HASH",
        "BOT_TELEGRAM_MTPROTO_SESSION_PATH",
        "BOT_TELEGRAM_PROXY_FAILOVER_DELAY_SECONDS",
        "CRM_API_BASE_URL",
        "BOT_CRM_BASE_URL",
        "CRM_BOT_API_TOKEN",
        "BOT_CRM_SERVICE_TOKEN",
        "BOT_MODE",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "http_proxy",
        "https_proxy",
    ]:
        monkeypatch.delenv(key, raising=False)


def test_settings_read_env_and_normalize_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local/")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")

    settings = Settings()

    assert settings.database_url == "sqlite+aiosqlite:///./test.db"
    assert settings.crm_base_url == "http://crm.local"
    assert settings.bot_mode == "LongPolling"
    assert settings.http_port == 8080
    assert settings.telegram_proxy_url is None


def test_settings_read_telegram_proxy_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv("BOT_TELEGRAM_PROXY_URL", "http://proxy.local:8080")

    settings = Settings()

    assert settings.telegram_proxy_url == "http://proxy.local:8080"


def test_settings_read_telegram_mtproxy_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv(
        "BOT_TELEGRAM_MTPROXY_URLS",
        "mtproxy://one.local:443/secret-one; mtproxy://two.local:443/secret-two",
    )
    monkeypatch.setenv("BOT_TELEGRAM_API_ID", "12345")
    monkeypatch.setenv("BOT_TELEGRAM_API_HASH", "api-hash")

    settings = Settings()

    assert settings.telegram_mtproxy_urls == (
        "mtproxy://one.local:443/secret-one",
        "mtproxy://two.local:443/secret-two",
    )
    assert settings.telegram_api_id == 12345
    assert settings.telegram_api_hash is not None
    assert settings.telegram_api_hash.get_secret_value() == "api-hash"


def test_settings_require_api_credentials_for_mtproxy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv("BOT_TELEGRAM_MTPROXY_URLS", "mtproxy://one.local:443/secret-one")

    with pytest.raises(ValueError, match="BOT_TELEGRAM_API_ID"):
        Settings()


def test_settings_reject_unsupported_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv("BOT_MODE", "Webhook")

    with pytest.raises(ValueError, match="LongPolling"):
        Settings()
