from __future__ import annotations

from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotService
from gym_crm_bot.telegram.adapter import TelegramPollingAdapter
from gym_crm_bot.telegram.mtproto_adapter import TelegramMtProtoAdapter


class TelegramAdapter(Protocol):
    async def run(self) -> None: ...

    async def stop(self) -> None: ...


def create_telegram_adapter(
    *,
    settings: Settings,
    bot_service: BotService,
    session_factory: async_sessionmaker[AsyncSession],
) -> TelegramAdapter:
    if settings.telegram_mtproxy_urls:
        return TelegramMtProtoAdapter(
            settings=settings,
            bot_service=bot_service,
            session_factory=session_factory,
        )
    return TelegramPollingAdapter(
        settings=settings,
        bot_service=bot_service,
        session_factory=session_factory,
    )
