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


def test_settings_reject_unsupported_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv("BOT_MODE", "Webhook")

    with pytest.raises(ValueError, match="LongPolling"):
        Settings()
