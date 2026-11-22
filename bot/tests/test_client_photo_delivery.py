from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx
from aiogram.types import BufferedInputFile, Message

from gym_crm_bot.core.service import BotService
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.telegram.adapter import TelegramPollingAdapter
from gym_crm_bot.telegram.mtproto_adapter import TelegramMtProtoAdapter
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


@pytest.mark.asyncio
@pytest.mark.parametrize("transport", ["polling", "mtproto"])
@respx.mock
async def test_photo_callback_delivers_only_fresh_authorized_bytes_in_private_chat(
    transport: str,
) -> None:
    client_id = "00000000-0000-0000-0000-000000000191"
    callback = f"cph|{client_id}"
    allowed_bytes = b"test photo"
    route = respx.get(f"http://crm.local/internal/bot/clients/{client_id}/photo").mock(
        side_effect=[
            httpx.Response(200, content=allowed_bytes, headers={"Content-Type": "image/png"}),
            httpx.Response(403),
        ]
    )
    respx.post("http://crm.local/internal/bot/audit/access-denied").mock(
        return_value=httpx.Response(200, json={})
    )
    deliveries: list[bytes] = []
    async with httpx.AsyncClient(base_url="http://crm.local") as http:
        crm = CrmBotApiClient(
            base_url="http://crm.local",
            service_token="service",
            timeout_seconds=5,
            http_client=http,
        )
        service = BotService(settings=MagicMock(), crm_client=crm, session_factory=MagicMock())
        if transport == "polling":

            async def answer_photo(file: BufferedInputFile) -> None:
                assert file.filename == "photo.png"
                deliveries.append(file.data)

            message = MagicMock(spec=Message)
            message.answer_photo = answer_photo
            message.answer = AsyncMock()
            message.edit_text = AsyncMock()
            query = SimpleNamespace(answer=AsyncMock(), message=message)
            adapter = TelegramPollingAdapter.__new__(TelegramPollingAdapter)
            adapter._service = service
            for i, chat_type in enumerate(["group", "private", "private"]):
                event = NormalizedTelegramEvent(
                    i, str(i), 777, chat_type, "777", "callback", callback_data=callback
                )
                await adapter._on_callback(query, normalized_event=event)
        else:

            async def respond(*, file: BytesIO) -> None:
                assert file.name == "photo.png"
                deliveries.append(file.read())

            event = SimpleNamespace(
                sender_id=777,
                chat_id=777,
                data=callback.encode(),
                id=1,
                respond=respond,
                answer=AsyncMock(),
                edit=AsyncMock(),
            )
            adapter = TelegramMtProtoAdapter.__new__(TelegramMtProtoAdapter)
            adapter._handle_guarded_event = service.handle_event
            for i, private in enumerate([False, True, True]):
                event.query_id = i + 1
                event.is_private = private
                await adapter._on_callback(event)
    assert deliveries == [allowed_bytes]
    assert route.call_count == 2
