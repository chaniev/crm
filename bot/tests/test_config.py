from __future__ import annotations

import pytest

from gym_crm_bot.config import Settings


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


def test_settings_reject_unsupported_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv("BOT_MODE", "Webhook")

    with pytest.raises(ValueError, match="LongPolling"):
        Settings()

