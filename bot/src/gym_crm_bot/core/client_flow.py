from __future__ import annotations

from typing import Any
from uuid import UUID

from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import MEMBERSHIP_SCENARIO, SEARCH_SCENARIO, DialogStateStore
from gym_crm_bot.core.idempotency import build_request_id
from gym_crm_bot.core.rendering import format_client_group
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmClientError
from gym_crm_bot.crm.models import (
    ClientCardResponse,
    MembershipListResponse,
)
from gym_crm_bot.resources.keyboards import (
    render_membership_list_keyboard,
    render_search_results_keyboard,
)
from gym_crm_bot.resources.messages import (
    EMPTY_SEARCH_RESULTS_MESSAGE,
    EXPIRING_EMPTY_MESSAGE,
    SEARCH_PROMPT_MESSAGE,
)
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent

PAGE_SIZE = 5


class ClientFlow:
    def __init__(
        self,
        *,
        crm_client: CrmBotApiClient,
        state_store: DialogStateStore,
        error_mapper: CrmErrorMapper,
    ) -> None:
        self._crm_client = crm_client
        self._state_store = state_store
        self._error_mapper = error_mapper

    async def start_search(self, event: NormalizedTelegramEvent) -> BotResponse:
        await self._state_store.clear_all(event)
        await self._state_store.save(event, SEARCH_SCENARIO, {"step": "await_query"})
        return BotResponse(text=SEARCH_PROMPT_MESSAGE, replace_existing=True)

    async def handle_text(self, event: NormalizedTelegramEvent) -> BotResponse:
        search_state = await self._state_store.get(event, SEARCH_SCENARIO)
        if search_state is None:
            return BotResponse(text="Используйте /start или кнопки меню.")

        query = (event.text or "").strip()
        if not query:
            return BotResponse(text=SEARCH_PROMPT_MESSAGE)

        return await self.search(event, query=query, page=1, replace_existing=False)

    async def search(
        self,
        event: NormalizedTelegramEvent,
        *,
        query: str,
        page: int,
        replace_existing: bool,
    ) -> BotResponse:
        try:
            response = await self._crm_client.search_clients(
                event.identity,
                query=query,
                page=page,
                page_size=PAGE_SIZE,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="client_search")

        await self._state_store.save(
            event,
            SEARCH_SCENARIO,
            {"step": "results", "query": query, "page": response.page},
        )
        if not response.items:
            return BotResponse(text=EMPTY_SEARCH_RESULTS_MESSAGE, replace_existing=replace_existing)

        return BotResponse(
            text=self._render_search_results_text(query, response.items, response.page),
            reply_markup=render_search_results_keyboard(
                response.items,
                page=response.page,
                has_next_page=response.has_next_page,
            ),
            replace_existing=replace_existing,
        )

    async def paginate_search(self, event: NormalizedTelegramEvent, page: int) -> BotResponse:
        state = await self._state_store.get(event, SEARCH_SCENARIO)
        if state is None or "query" not in state:
            return await self.start_search(event)
        return await self.search(
            event,
            query=state["query"],
            page=page,
            replace_existing=True,
        )

    async def show_card(
        self,
        event: NormalizedTelegramEvent,
        client_id: UUID,
        *,
        replace_existing: bool,
    ) -> BotResponse:
        try:
            card = await self._crm_client.get_client_card(
                event.identity,
                client_id=client_id,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="client_card")
        return BotResponse(text=render_client_card(card), replace_existing=replace_existing)

    async def show_memberships(
        self,
        event: NormalizedTelegramEvent,
        *,
        list_code: str,
        page: int,
        replace_existing: bool,
    ) -> BotResponse:
        if list_code != "expiring_memberships":
            return BotResponse(text="Команда не поддерживается.", replace_existing=True)

        try:
            response = await self._crm_client.list_expiring_memberships(
                event.identity,
                page=page,
                page_size=PAGE_SIZE,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason=list_code)

        await self._state_store.save(
            event,
            MEMBERSHIP_SCENARIO,
            {"list_code": list_code, "page": response.page},
        )

        if not response.items:
            return BotResponse(text=EXPIRING_EMPTY_MESSAGE, replace_existing=replace_existing)

        return BotResponse(
            text=self._render_membership_list_text("Заканчивающиеся абонементы", response),
            reply_markup=render_membership_list_keyboard(
                response.items,
                page=response.page,
                has_next_page=response.has_next_page,
                list_code=list_code,
            ),
            replace_existing=replace_existing,
        )

    @staticmethod
    def _render_client_card(card: ClientCardResponse) -> str:
        return render_client_card(card)

    @staticmethod
    def _render_search_results_text(query: str, items: list[Any], page: int) -> str:
        lines = [f"Результаты поиска: {query}", f"Страница: {page}", ""]
        for index, item in enumerate(items, start=1):
            if item.is_professional:
                suffix = " | Профессионал"
            else:
                suffix = f" | {item.membership_label}" if item.membership_label else ""
            lines.append(f"{index}. {item.full_name}{suffix}")
        return "\n".join(lines)

    @staticmethod
    def _render_membership_list_text(title: str, response: MembershipListResponse) -> str:
        lines = [title, f"Страница: {response.page}", ""]
        for index, item in enumerate(response.items, start=1):
            details = []
            if item.membership_label:
                details.append(item.membership_label)
            if item.membership_expires_at:
                details.append(item.membership_expires_at.strftime("%d.%m.%Y"))
            target_summary = format_target_groups(item.target_groups)
            if target_summary:
                details.append(target_summary)
            suffix = f" | {' | '.join(details)}" if details else ""
            lines.append(f"{index}. {item.full_name}{suffix}")
        return "\n".join(lines)


def render_client_card(card: ClientCardResponse) -> str:
    lines = [card.full_name]
    if card.phone:
        lines.append(f"Телефон: {card.phone}")
    if card.status:
        lines.append(f"Статус: {card.status}")
    if card.groups:
        lines.append("Группы: " + ", ".join(format_client_group(group) for group in card.groups))
    if card.is_professional:
        comment = f": {card.professional_comment}" if card.professional_comment else ""
        lines.append(f"Профессионал{comment}")
    if card.warning:
        lines.append(f"Предупреждение: {card.warning}")
    for membership in card.current_memberships:
        lines.append(
            "Абонемент: "
            f"{membership.type_label}, "
            f"покупка {membership.purchase_date.strftime('%d.%m.%Y')}, "
            f"оплата {membership.payment_date.strftime('%d.%m.%Y')}"
        )
        if membership.expiration_date is not None:
            lines.append(f"Действует до: {membership.expiration_date.strftime('%d.%m.%Y')}")
        if membership.coverage_kind == "AllGroups":
            reporting_group = next(
                (target.group_name for target in membership.target_groups if target.position == 0),
                None,
            )
            if reporting_group:
                lines.append(f"Доступ: все группы; отчётность: {reporting_group}")
            else:
                lines.append("Доступ: все группы")
        elif membership.target_groups:
            lines.append(f"Группы абонемента: {format_target_groups(membership.target_groups)}")
        if membership.entitlement_state == "LegacyTargetMissing":
            lines.append("Предупреждение: абонемент без групп, требуется исправление")
    if card.attendance_history:
        lines.append("История посещений:")
        for item in card.attendance_history[:5]:
            marker = "Был" if item.is_present else "Не был"
            lines.append(
                f"- {item.training_date.strftime('%d.%m.%Y')} | {item.group_name} | {marker}"
            )
    return "\n".join(lines)


def format_target_groups(target_groups: list[Any]) -> str:
    if not target_groups:
        return ""

    return ", ".join(
        f"{target.position + 1}. {target.group_name}"
        + (" (отчётность)" if target.position == 0 else "")
        for target in sorted(target_groups, key=lambda target: target.position)
    )
