from __future__ import annotations

import asyncio
import hashlib
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from aiogram.types import InlineKeyboardMarkup
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotResponse, BotService
from gym_crm_bot.resources.messages import PRIVATE_CHAT_ONLY_MESSAGE
from gym_crm_bot.storage.db import session_scope
from gym_crm_bot.storage.repositories import ProcessedUpdateRepository
from gym_crm_bot.telegram.mtproxy import MtProxyEndpoint, parse_mtproxy_urls
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent

logger = logging.getLogger(__name__)

PROCESSED_UPDATE_PLATFORM = "TelegramMtProto"


class TelethonClient(Protocol):
    def add_event_handler(self, callback: Callable[..., Awaitable[Any]], event: object) -> None: ...

    async def start(self, *, bot_token: str) -> Any: ...

    async def run_until_disconnected(self) -> Any: ...

    async def disconnect(self) -> Any: ...


class TelegramMtProtoAdapter:
    def __init__(
        self,
        *,
        settings: Settings,
        bot_service: BotService,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        if settings.telegram_api_id is None or settings.telegram_api_hash is None:
            msg = "Telegram API id/hash are required for MTProxy transport."
            raise ValueError(msg)

        self._settings = settings
        self._service = bot_service
        self._session_factory = session_factory
        self._endpoints = parse_mtproxy_urls(settings.telegram_mtproxy_urls)
        if not self._endpoints:
            msg = "At least one MTProxy endpoint is required for MTProto adapter."
            raise ValueError(msg)

        self._api_id = settings.telegram_api_id
        self._api_hash = settings.telegram_api_hash.get_secret_value()
        self._bot_token = settings.telegram_token.get_secret_value()
        self._stop_event = asyncio.Event()
        self._client: TelethonClient | None = None
        self._next_endpoint_index = 0

    async def run(self) -> None:
        while not self._stop_event.is_set():
            endpoint = self._endpoints[self._next_endpoint_index % len(self._endpoints)]
            self._next_endpoint_index += 1
            try:
                await self._run_with_endpoint(endpoint)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning(
                    "Telegram MTProto transport failed via MTProxy %s. Trying next proxy.",
                    endpoint.safe_name,
                    exc_info=True,
                )

            if not self._stop_event.is_set():
                await self._wait_before_next_attempt()

    async def stop(self) -> None:
        self._stop_event.set()
        client = self._client
        if client is not None:
            await client.disconnect()

    async def _run_with_endpoint(self, endpoint: MtProxyEndpoint) -> None:
        client = self._create_client(endpoint)
        self._client = client
        try:
            logger.info("Starting Telegram MTProto polling via MTProxy %s.", endpoint.safe_name)
            await client.start(bot_token=self._bot_token)
            logger.info("Telegram MTProto polling started via MTProxy %s.", endpoint.safe_name)
            await client.run_until_disconnected()
        finally:
            if self._client is client:
                self._client = None
            await client.disconnect()

    def _create_client(self, endpoint: MtProxyEndpoint) -> TelethonClient:
        try:
            from telethon import TelegramClient, events
            from telethon.network import connection
        except ImportError as exc:
            msg = (
                "Telethon is required for BOT_TELEGRAM_MTPROXY_URLS. "
                "Rebuild the bot image after updating dependencies."
            )
            raise RuntimeError(msg) from exc

        session_path = Path(self._settings.telegram_mtproto_session_path)
        session_path.parent.mkdir(parents=True, exist_ok=True)
        client = TelegramClient(
            str(session_path),
            self._api_id,
            self._api_hash,
            connection=connection.ConnectionTcpMTProxyRandomizedIntermediate,
            proxy=endpoint.telethon_proxy,
        )
        client.add_event_handler(self._on_message, events.NewMessage())
        client.add_event_handler(self._on_callback, events.CallbackQuery())
        return client

    async def _wait_before_next_attempt(self) -> None:
        try:
            await asyncio.wait_for(
                self._stop_event.wait(),
                timeout=self._settings.telegram_proxy_failover_delay_seconds,
            )
        except TimeoutError:
            return

    async def _on_message(self, event: Any) -> None:
        normalized_event = await self._normalize_message_event(event)
        if normalized_event is None:
            return
        if normalized_event.chat_type != "private":
            await event.respond(PRIVATE_CHAT_ONLY_MESSAGE)
            return

        response = await self._handle_guarded_event(normalized_event)
        if response is not None:
            await event.respond(response.text, buttons=_to_telethon_buttons(response.reply_markup))

    async def _on_callback(self, event: Any) -> None:
        normalized_event = await self._normalize_callback_event(event)
        if normalized_event is None:
            await event.answer()
            return
        if normalized_event.chat_type != "private":
            await event.answer(PRIVATE_CHAT_ONLY_MESSAGE)
            return

        response = await self._handle_guarded_event(normalized_event)
        await event.answer()
        if response is None:
            return

        buttons = _to_telethon_buttons(response.reply_markup)
        if response.replace_existing:
            try:
                await event.edit(response.text, buttons=buttons)
                return
            except Exception:
                logger.warning("Unable to edit Telegram callback message.", exc_info=True)

        await event.respond(response.text, buttons=buttons)

    async def _handle_guarded_event(
        self,
        normalized_event: NormalizedTelegramEvent,
    ) -> BotResponse | None:
        reserved = await self._reserve_update(
            normalized_event.update_id,
            normalized_event.event_key,
        )
        if not reserved:
            return None

        try:
            response = await self._service.handle_event(normalized_event)
        except Exception:
            await self._release_update(normalized_event.update_id)
            raise

        await self._mark_processed(normalized_event.update_id)
        return response

    async def _reserve_update(self, update_id: int, event_key: str) -> bool:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            return await repo.reserve(
                platform=PROCESSED_UPDATE_PLATFORM,
                update_id=update_id,
                event_key=event_key,
            )

    async def _mark_processed(self, update_id: int) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            await repo.mark_processed(
                platform=PROCESSED_UPDATE_PLATFORM,
                update_id=update_id,
                result={"status": "processed"},
                processed_at=datetime.now(UTC),
            )

    async def _release_update(self, update_id: int) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ProcessedUpdateRepository(session)
            await repo.release(platform=PROCESSED_UPDATE_PLATFORM, update_id=update_id)

    async def _normalize_message_event(self, event: Any) -> NormalizedTelegramEvent | None:
        sender_id = await _get_sender_id(event)
        message_id = _get_message_id(event)
        chat_id = getattr(event, "chat_id", None)
        if sender_id is None or message_id is None or chat_id is None:
            return None

        text = str(getattr(event, "raw_text", "") or "")
        kind = "command" if text.startswith("/") else "text"
        command = None
        if kind == "command":
            command = text.split(maxsplit=1)[0][1:].split("@", 1)[0].lower()

        event_key = f"mtproto:message:{chat_id}:{message_id}"
        return NormalizedTelegramEvent(
            update_id=_stable_update_id(event_key),
            event_key=event_key,
            chat_id=int(chat_id),
            chat_type=_chat_type(event),
            platform_user_id=str(sender_id),
            kind=kind,
            command=command,
            text=text,
        )

    async def _normalize_callback_event(self, event: Any) -> NormalizedTelegramEvent | None:
        sender_id = await _get_sender_id(event)
        chat_id = getattr(event, "chat_id", None)
        data = getattr(event, "data", b"")
        callback_data = data.decode("utf-8") if isinstance(data, bytes) else str(data or "")
        query_id = getattr(event, "query_id", None) or getattr(event, "id", None)
        message_id = getattr(event, "message_id", None) or _get_message_id(event)
        if sender_id is None or chat_id is None:
            return None

        event_key_parts = [
            "mtproto",
            "callback",
            str(chat_id),
            str(message_id or "unknown"),
            str(query_id or callback_data),
        ]
        event_key = ":".join(event_key_parts)
        return NormalizedTelegramEvent(
            update_id=_stable_update_id(event_key),
            event_key=event_key,
            chat_id=int(chat_id),
            chat_type=_chat_type(event),
            platform_user_id=str(sender_id),
            kind="callback",
            callback_data=callback_data,
        )


def _to_telethon_buttons(markup: InlineKeyboardMarkup | None) -> list[list[object]] | None:
    if markup is None:
        return None

    from telethon import Button

    return [
        [
            Button.inline(
                button.text,
                data=str(button.callback_data or "").encode("utf-8"),
            )
            for button in row
        ]
        for row in markup.inline_keyboard
    ]


async def _get_sender_id(event: Any) -> int | None:
    sender_id = getattr(event, "sender_id", None)
    if sender_id is not None:
        return int(sender_id)

    get_sender = getattr(event, "get_sender", None)
    if get_sender is None:
        return None
    sender = await get_sender()
    resolved_sender_id = getattr(sender, "id", None)
    return None if resolved_sender_id is None else int(resolved_sender_id)


def _get_message_id(event: Any) -> int | None:
    message = getattr(event, "message", None)
    message_id = getattr(message, "id", None)
    if message_id is not None:
        return int(message_id)

    event_id = getattr(event, "id", None)
    return None if event_id is None else int(event_id)


def _chat_type(event: Any) -> str:
    if bool(getattr(event, "is_private", False)):
        return "private"
    if bool(getattr(event, "is_channel", False)):
        return "supergroup"
    return "group"


def _stable_update_id(event_key: str) -> int:
    digest = hashlib.blake2s(event_key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") & ((1 << 63) - 1)
