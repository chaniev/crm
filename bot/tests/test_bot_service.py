from __future__ import annotations

from dataclasses import dataclass

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotService
from gym_crm_bot.crm.errors import CrmUserNotConfiguredError
from gym_crm_bot.crm.models import BotUserContext, MenuItem, MenuResponse
from gym_crm_bot.storage.models import Base
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


@dataclass
class FakeCrmClient:
    known_user: bool = True

    async def resolve_session(self, identity, *, request_id: str):  # noqa: ANN001
        if not self.known_user:
            raise CrmUserNotConfiguredError("not configured")
        return BotUserContext(
            crm_user_id="00000000-0000-0000-0000-000000000001",
            display_name="Иван",
            role="Coach",
        )

    async def get_menu(self, identity, *, request_id: str):  # noqa: ANN001
        return MenuResponse(items=[MenuItem(code="attendance", title="Посещения")])

    async def audit_access_denied(self, identity, *, request_id: str, reason: str) -> None:  # noqa: ANN001
        return None


@pytest.fixture()
def settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    return Settings()


@pytest.fixture()
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_unknown_user_id_command_returns_safe_message(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(known_user=False),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=1,
            event_key="message:1",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="command",
            command="id",
            text="/id",
        )
    )

    assert response.text == (
        "Ваш Telegram ID: 777. Передайте его администратору CRM для подключения бота."
    )


@pytest.mark.asyncio
async def test_start_for_known_user_returns_menu(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(known_user=True),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=2,
            event_key="message:2",
            chat_id=10,
            chat_type="private",
            platform_user_id="888",
            kind="command",
            command="start",
            text="/start",
        )
    )

    assert response.text == "Иван, выберите действие."
    assert response.reply_markup is not None
    assert response.reply_markup.inline_keyboard[0][0].callback_data == "menu|attendance"

