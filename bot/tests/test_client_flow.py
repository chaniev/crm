from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import httpx
import pytest
import respx

from gym_crm_bot.core.client_flow import ClientFlow, render_client_card
from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import (
    ATTENDANCE_SCENARIO,
    MEMBERSHIP_SCENARIO,
    SEARCH_SCENARIO,
)
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import (
    ClientCardResponse,
    ClientListItem,
    ClientSearchResponse,
    MembershipListResponse,
)
from gym_crm_bot.resources.messages import TEMPORARY_ERROR_MESSAGE
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


def test_card_renders_first_five_attendance_marks_in_api_order() -> None:
    card = ClientCardResponse.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000031",
            "fullName": "Петр Иванов",
            "attendanceHistory": [
                {"trainingDate": date, "groupName": "Группа", "isPresent": present}
                for date, present in [
                    ("2026-11-20", False),
                    ("2026-11-20", True),
                    ("2026-11-19", True),
                    ("2026-11-18", True),
                    ("2026-11-17", True),
                    ("2026-11-16", True),
                ]
            ],
        }
    )

    rows = [line for line in render_client_card(card).splitlines() if line.startswith("- ")]
    assert rows == [
        "- 20.11.2026 | Группа | Не был",
        "- 20.11.2026 | Группа | Был",
        "- 19.11.2026 | Группа | Был",
        "- 18.11.2026 | Группа | Был",
        "- 17.11.2026 | Группа | Был",
    ]


@dataclass
class InMemoryDialogState:
    states: dict[str, dict[str, Any]] = field(default_factory=dict)

    async def get(
        self,
        event: NormalizedTelegramEvent,
        scenario: str,
    ) -> dict[str, Any] | None:
        state = self.states.get(scenario)
        return None if state is None else dict(state)

    async def save(
        self,
        event: NormalizedTelegramEvent,
        scenario: str,
        state_json: dict[str, Any],
    ) -> None:
        self.states[scenario] = dict(state_json)

    async def clear_all(self, event: NormalizedTelegramEvent) -> None:
        self.states.clear()


@dataclass
class FlakyClientCrmClient:
    client_id: UUID = UUID("00000000-0000-0000-0000-000000000031")
    search_failures: int = 1
    card_failures: int = 1
    membership_failures: int = 1
    request_ids: list[str] = field(default_factory=list)
    search_requests: list[tuple[str, int, int, str]] = field(default_factory=list)

    async def search_clients(  # noqa: ANN001
        self,
        identity,
        *,
        query: str,
        page: int,
        page_size: int,
        request_id: str,
    ) -> ClientSearchResponse:
        self.request_ids.append(request_id)
        self.search_requests.append((query, page, page_size, request_id))
        if self.search_failures > 0:
            self.search_failures -= 1
            raise CrmTemporaryError("temporary client search failure")
        return ClientSearchResponse(
            items=[
                ClientListItem(
                    id=self.client_id,
                    fullName="Петр Иванов",
                    membershipLabel="Месячный",
                )
            ],
            skip=0,
            take=page_size,
            hasMore=False,
        )

    async def get_client_card(  # noqa: ANN001
        self,
        identity,
        *,
        client_id: UUID,
        request_id: str,
    ) -> ClientCardResponse:
        self.request_ids.append(request_id)
        if self.card_failures > 0:
            self.card_failures -= 1
            raise CrmTemporaryError("temporary client card failure")
        return ClientCardResponse(id=client_id, fullName="Петр Иванов")

    async def list_expiring_memberships(  # noqa: ANN001
        self,
        identity,
        *,
        page: int,
        page_size: int,
        request_id: str,
    ) -> MembershipListResponse:
        self.request_ids.append(request_id)
        if self.membership_failures > 0:
            self.membership_failures -= 1
            raise CrmTemporaryError("temporary membership list failure")
        return MembershipListResponse(items=[], page=page, pageSize=page_size, hasNextPage=False)


def _event(
    *,
    update_id: int,
    kind: str,
    text: str | None = None,
    callback_data: str | None = None,
) -> NormalizedTelegramEvent:
    return NormalizedTelegramEvent(
        update_id=update_id,
        event_key=f"event:{update_id}",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind=kind,
        text=text,
        callback_data=callback_data,
    )


@pytest.mark.asyncio
async def test_search_cleanup_error_and_retry_preserve_expected_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(["client-search-failed", "client-search-retry"])
    monkeypatch.setattr(
        "gym_crm_bot.core.client_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = FlakyClientCrmClient()
    state_store = InMemoryDialogState()
    flow = ClientFlow(
        crm_client=crm_client,
        state_store=state_store,
        error_mapper=CrmErrorMapper(crm_client),
    )
    callback_event = _event(
        update_id=930,
        kind="callback",
        callback_data="menu|client_search",
    )
    await state_store.save(callback_event, ATTENDANCE_SCENARIO, {"step": "draft"})
    await state_store.save(
        callback_event,
        MEMBERSHIP_SCENARIO,
        {"list_code": "expiring_memberships", "page": 2},
    )

    start = await flow.start_search(callback_event)

    assert start == BotResponse(
        text="Введите ФИО или телефон клиента.",
        replace_existing=True,
    )
    assert state_store.states == {SEARCH_SCENARIO: {"step": "await_query"}}

    text_event = _event(update_id=931, kind="text", text="  Петр  ")
    failure = await flow.handle_text(text_event)

    assert failure == BotResponse(text=TEMPORARY_ERROR_MESSAGE)
    assert state_store.states == {SEARCH_SCENARIO: {"step": "await_query"}}

    retry = await flow.handle_text(text_event)

    assert retry.text == "Результаты поиска: Петр\nСтраница: 1\n\n1. Петр Иванов | Месячный"
    assert state_store.states == {SEARCH_SCENARIO: {"step": "results", "query": "Петр", "page": 1}}
    assert crm_client.search_requests == [
        ("Петр", 1, 5, "client-search-failed"),
        ("Петр", 1, 5, "client-search-retry"),
    ]


@pytest.mark.asyncio
async def test_card_and_membership_errors_keep_dialog_state_and_exact_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(["client-card-failed", "memberships-failed"])
    monkeypatch.setattr(
        "gym_crm_bot.core.client_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = FlakyClientCrmClient()
    state_store = InMemoryDialogState()
    flow = ClientFlow(
        crm_client=crm_client,
        state_store=state_store,
        error_mapper=CrmErrorMapper(crm_client),
    )
    event = _event(
        update_id=940,
        kind="callback",
        callback_data=f"ccd|{crm_client.client_id}",
    )
    search_state = {"step": "results", "query": "Петр", "page": 1}
    membership_state = {"list_code": "expiring_memberships", "page": 1}
    await state_store.save(event, SEARCH_SCENARIO, search_state)
    await state_store.save(event, MEMBERSHIP_SCENARIO, membership_state)

    card_failure = await flow.show_card(
        event,
        crm_client.client_id,
        replace_existing=True,
    )
    membership_failure = await flow.show_memberships(
        event,
        list_code="expiring_memberships",
        page=2,
        replace_existing=True,
    )

    assert card_failure == BotResponse(text=TEMPORARY_ERROR_MESSAGE, replace_existing=True)
    assert membership_failure == BotResponse(
        text=TEMPORARY_ERROR_MESSAGE,
        replace_existing=True,
    )
    assert state_store.states == {
        SEARCH_SCENARIO: search_state,
        MEMBERSHIP_SCENARIO: membership_state,
    }
    assert crm_client.request_ids == ["client-card-failed", "memberships-failed"]


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [None, {"title": "NotFound", "detail": "private stale client"}])
@respx.mock
async def test_stale_client_callback_replaces_card_and_keyboard_on_resource_404(
    body: dict[str, str] | None,
) -> None:
    client_id = UUID("00000000-0000-0000-0000-000000000191")
    route = respx.get(f"http://crm.local/internal/bot/clients/{client_id}").mock(
        side_effect=[
            httpx.Response(200, json={"id": str(client_id), "fullName": "Private old name"}),
            httpx.Response(404) if body is None else httpx.Response(404, json=body),
        ]
    )
    async with httpx.AsyncClient(base_url="http://crm.local") as http:
        crm = CrmBotApiClient(
            base_url="http://crm.local",
            service_token="test-token",
            timeout_seconds=5,
            read_retry_attempts=3,
            http_client=http,
        )
        flow = ClientFlow(
            crm_client=crm, state_store=InMemoryDialogState(), error_mapper=CrmErrorMapper(crm)
        )
        event = _event(update_id=191, kind="callback", callback_data=f"client|{client_id}")
        original = await flow.show_card(event, client_id, replace_existing=True)
        assert "Private old name" in original.text
        denied = await flow.show_card(event, client_id, replace_existing=True)
    assert denied == BotResponse(
        text="Данные больше недоступны. Откройте список заново.",
        replace_existing=True,
    )
    assert denied.reply_markup is None
    assert route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_photo_button_refetches_bytes_and_preserves_card_when_photo_disappears() -> None:
    client_id = UUID("00000000-0000-0000-0000-000000000191")
    url = f"http://crm.local/internal/bot/clients/{client_id}"
    card = {"id": str(client_id), "fullName": "Клиент"}
    respx.get(url).mock(
        side_effect=[
            httpx.Response(200, json=card),
            httpx.Response(200, json={**card, "photo": {"hasPhoto": True, "path": "private.jpg"}}),
        ]
    )
    photo = respx.get(f"{url}/photo").mock(
        side_effect=[
            httpx.Response(200, content=b"photo bytes", headers={"Content-Type": "image/png"}),
            httpx.Response(404),
            httpx.Response(403),
        ]
    )
    respx.post("http://crm.local/internal/bot/audit/access-denied").mock(
        return_value=httpx.Response(200, json={})
    )
    async with httpx.AsyncClient(base_url="http://crm.local") as http:
        crm = CrmBotApiClient(
            base_url="http://crm.local",
            service_token="service",
            timeout_seconds=5,
            http_client=http,
        )
        flow = ClientFlow(
            crm_client=crm, state_store=InMemoryDialogState(), error_mapper=CrmErrorMapper(crm)
        )
        event = _event(update_id=1, kind="callback", callback_data=f"cph|{client_id}")
        assert (await flow.show_card(event, client_id, replace_existing=True)).reply_markup is None
        with_photo = await flow.show_card(event, client_id, replace_existing=True)
        button = with_photo.reply_markup.inline_keyboard[0][0]
        assert button.text == "Показать фото"
        assert button.callback_data == event.callback_data
        first = await flow.show_photo(event, client_id)
        assert first.photo.content == b"photo bytes"
        assert first.photo.filename == "photo.png"
        missing = await flow.show_photo(event, client_id)
        assert missing.photo is None and not missing.replace_existing
        denied = await flow.show_photo(event, client_id)
        assert denied.photo is None and denied.replace_existing
    assert photo.call_count == 3
    assert len({call.request.headers["X-Request-Id"] for call in photo.calls}) == 3
    for call in photo.calls:
        assert dict(call.request.url.params) == {"platform": "Telegram", "platformUserId": "777"}
        assert call.request.headers["Authorization"] == "Bearer service"
