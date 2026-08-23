from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import pytest

from gym_crm_bot.core.client_flow import ClientFlow
from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import (
    ATTENDANCE_SCENARIO,
    MEMBERSHIP_SCENARIO,
    SEARCH_SCENARIO,
)
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import (
    ClientCardResponse,
    ClientListItem,
    ClientSearchResponse,
    MembershipListResponse,
)
from gym_crm_bot.resources.messages import TEMPORARY_ERROR_MESSAGE
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


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
