from __future__ import annotations

from aiogram import Bot, Dispatcher, Router
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotResponse, BotService
from gym_crm_bot.telegram.middleware import UpdateGuardMiddleware
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


class TelegramPollingAdapter:
    def __init__(
        self,
        *,
        settings: Settings,
        bot_service: BotService,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._service = bot_service
        self._bot = Bot(settings.telegram_token.get_secret_value())
        self._dispatcher = Dispatcher()
        self._dispatcher.update.outer_middleware(UpdateGuardMiddleware(session_factory))

        router = Router()
        router.message.register(self._on_message)
        router.callback_query.register(self._on_callback)
        self._dispatcher.include_router(router)

    async def run(self) -> None:
        await self._dispatcher.start_polling(self._bot)

    async def stop(self) -> None:
        await self._bot.session.close()

    async def _on_message(
        self,
        message: Message,
        normalized_event: NormalizedTelegramEvent,
    ) -> None:
        response = await self._service.handle_event(normalized_event)
        await self._send_message(message, response)

    async def _on_callback(
        self,
        callback_query: CallbackQuery,
        normalized_event: NormalizedTelegramEvent,
    ) -> None:
        response = await self._service.handle_event(normalized_event)
        await callback_query.answer()
        await self._send_callback_response(callback_query, response)

    @staticmethod
    async def _send_message(message: Message, response: BotResponse) -> None:
        await message.answer(response.text, reply_markup=response.reply_markup)

    @staticmethod
    async def _send_callback_response(callback_query: CallbackQuery, response: BotResponse) -> None:
        target_message = callback_query.message
        if response.replace_existing and target_message is not None:
            await target_message.edit_text(response.text, reply_markup=response.reply_markup)
            return
        if target_message is not None:
            await target_message.answer(response.text, reply_markup=response.reply_markup)

