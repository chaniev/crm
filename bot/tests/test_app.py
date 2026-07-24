from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import pytest
from sqlalchemy import text

from gym_crm_bot.app import create_application
from gym_crm_bot.config import Settings


def _set_base_env(monkeypatch: pytest.MonkeyPatch, database_path: Path) -> None:
    for key in [
        "BOT_DATABASE_URL",
        "BOT_ENABLED",
        "BOT_TELEGRAM_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "BOT_CRM_BASE_URL",
        "BOT_CRM_SERVICE_TOKEN",
        "CRM_API_BASE_URL",
        "CRM_BOT_API_TOKEN",
    ]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("BOT_DATABASE_URL", f"sqlite+aiosqlite:///{database_path}")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")


@pytest.mark.asyncio
async def test_disabled_application_starts_storage_and_health_without_telegram(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _set_base_env(monkeypatch, tmp_path / "bot.db")
    monkeypatch.setenv("BOT_ENABLED", "false")

    def fail_create_telegram_adapter(**_: Any) -> Any:
        raise AssertionError("Telegram adapter must not be created when BOT_ENABLED=false.")

    monkeypatch.setattr("gym_crm_bot.app.create_telegram_adapter", fail_create_telegram_adapter)

    application = create_application(Settings())

    assert application.telegram is None

    await application.start()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application.web_app),
            base_url="http://test",
        ) as client:
            response = await client.get("/health/ready")

        assert response.status_code == 200
        assert response.json() == {"status": "ready"}

        async with application.engine.connect() as connection:
            result = await connection.execute(
                text(
                    "SELECT name FROM sqlite_master "
                    "WHERE type = 'table' AND name = 'bot_conversation_states'"
                )
            )

        assert result.scalar_one() == "bot_conversation_states"
    finally:
        await application.stop()


def test_enabled_application_uses_current_telegram_factory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _set_base_env(monkeypatch, tmp_path / "bot.db")
    monkeypatch.setenv("BOT_ENABLED", "true")
    monkeypatch.setenv("BOT_TELEGRAM_TOKEN", "telegram-token")
    created: dict[str, bool] = {}

    class FakeTelegramAdapter:
        async def run(self) -> None:
            return None

        async def stop(self) -> None:
            return None

    def create_fake_telegram_adapter(**_: Any) -> FakeTelegramAdapter:
        created["telegram"] = True
        return FakeTelegramAdapter()

    monkeypatch.setattr("gym_crm_bot.app.create_telegram_adapter", create_fake_telegram_adapter)

    application = create_application(Settings())

    assert created == {"telegram": True}
    assert isinstance(application.telegram, FakeTelegramAdapter)
