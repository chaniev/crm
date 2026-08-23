from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.storage.db import session_scope
from gym_crm_bot.storage.repositories import ConversationStateRepository
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent

ATTENDANCE_SCENARIO = "attendance"
SEARCH_SCENARIO = "client_search"
MEMBERSHIP_SCENARIO = "membership_list"
STATEFUL_SCENARIOS = (ATTENDANCE_SCENARIO, SEARCH_SCENARIO, MEMBERSHIP_SCENARIO)


class DialogStateStore:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory

    async def get(
        self,
        event: NormalizedTelegramEvent,
        scenario: str,
    ) -> dict[str, Any] | None:
        async with session_scope(self._session_factory) as session:
            repo = ConversationStateRepository(session)
            state = await repo.get(
                platform="Telegram",
                chat_id=event.chat_id,
                platform_user_id=event.platform_user_id,
                scenario=scenario,
                now=datetime.now(UTC),
            )
            return None if state is None else dict(state.state_json)

    async def save(
        self,
        event: NormalizedTelegramEvent,
        scenario: str,
        state_json: dict[str, Any],
    ) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ConversationStateRepository(session)
            await repo.upsert(
                platform="Telegram",
                chat_id=event.chat_id,
                platform_user_id=event.platform_user_id,
                scenario=scenario,
                state_json=state_json,
                expires_at=datetime.now(UTC)
                + timedelta(hours=self._settings.conversation_state_ttl_hours),
            )

    async def clear_all(self, event: NormalizedTelegramEvent) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ConversationStateRepository(session)
            for scenario in STATEFUL_SCENARIOS:
                await repo.clear(
                    platform="Telegram",
                    chat_id=event.chat_id,
                    platform_user_id=event.platform_user_id,
                    scenario=scenario,
                )
