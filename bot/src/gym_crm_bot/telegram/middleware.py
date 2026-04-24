from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject, Update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.resources.messages import PRIVATE_CHAT_ONLY_MESSAGE
from gym_crm_bot.storage.db import session_scope
from gym_crm_bot.storage.repositories import ProcessedUpdateRepository
from gym_crm_bot.telegram.normalization import normalize_update


class UpdateGuardMiddleware(BaseMiddleware):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        update = data.get("event_update")
        if not isinstance(update, Update):
            return await handler(event, data)

        normalized = normalize_update(update)
        if normalized is None:
            return None

        if normalized.chat_type != "private":
            await self._send_private_chat_refusal(update)
            return None

        reserved = await self._reserve_update(normalized.update_id, normalized.event_key)
        if not reserved:
            return None

        data["normalized_event"] = normalized
        try:
            result = await handler(event, data)
        except Exception:
            await self._release_update(normalized.update_id)
            raise

        await self._mark_processed(normalized.update_id)
        return result

    async def _reserve_update(self, update_id: int, event_key: str) -> bool:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            return await repo.reserve(platform="Telegram", update_id=update_id, event_key=event_key)

    async def _mark_processed(self, update_id: int) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            await repo.mark_processed(
                platform="Telegram",
                update_id=update_id,
                result={"status": "processed"},
                processed_at=datetime.now(UTC),
            )

    async def _release_update(self, update_id: int) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            await repo.release(platform="Telegram", update_id=update_id)

    @staticmethod
    async def _send_private_chat_refusal(update: Update) -> None:
        if isinstance(update.message, Message):
            await update.message.answer(PRIVATE_CHAT_ONLY_MESSAGE)
        elif isinstance(update.callback_query, CallbackQuery):
            await update.callback_query.answer(PRIVATE_CHAT_ONLY_MESSAGE)

