from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.config import Settings
from gym_crm_bot.core.dialog_state import ATTENDANCE_SCENARIO, SEARCH_SCENARIO, DialogStateStore
from gym_crm_bot.storage.models import Base
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


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


def _event(*, chat_id: int, platform_user_id: str) -> NormalizedTelegramEvent:
    return NormalizedTelegramEvent(
        update_id=1,
        event_key="message:1",
        chat_id=chat_id,
        chat_type="private",
        platform_user_id=platform_user_id,
        kind="text",
        text="query",
    )


@pytest.mark.asyncio
async def test_dialog_state_store_upserts_clears_and_isolates_by_chat_user_and_scenario(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    store = DialogStateStore(settings=settings, session_factory=session_factory)
    primary = _event(chat_id=10, platform_user_id="777")
    other_user = _event(chat_id=10, platform_user_id="888")
    other_chat = _event(chat_id=20, platform_user_id="777")

    await store.save(primary, ATTENDANCE_SCENARIO, {"step": "select_date"})
    await store.save(primary, SEARCH_SCENARIO, {"step": "await_query"})
    await store.save(other_user, ATTENDANCE_SCENARIO, {"step": "other_user"})
    await store.save(other_chat, ATTENDANCE_SCENARIO, {"step": "other_chat"})
    await store.save(primary, ATTENDANCE_SCENARIO, {"step": "draft"})

    assert await store.get(primary, ATTENDANCE_SCENARIO) == {"step": "draft"}
    assert await store.get(primary, SEARCH_SCENARIO) == {"step": "await_query"}
    assert await store.get(other_user, ATTENDANCE_SCENARIO) == {"step": "other_user"}
    assert await store.get(other_chat, ATTENDANCE_SCENARIO) == {"step": "other_chat"}

    await store.clear_all(primary)

    assert await store.get(primary, ATTENDANCE_SCENARIO) is None
    assert await store.get(primary, SEARCH_SCENARIO) is None
    assert await store.get(other_user, ATTENDANCE_SCENARIO) == {"step": "other_user"}
    assert await store.get(other_chat, ATTENDANCE_SCENARIO) == {"step": "other_chat"}
