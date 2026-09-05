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
from gym_crm_bot.resources import bot_3_clients_rendering as bot_3_clients_rendering_text
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
            return BotResponse(text=bot_3_clients_rendering_text.CLIENT_FLOW_LINE_51_48F52AA0)

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
            return BotResponse(
                text=bot_3_clients_rendering_text.CLIENT_FLOW_LINE_133_21BB98EE,
                replace_existing=True,
            )

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
            text=self._render_membership_list_text(
                bot_3_clients_rendering_text.CLIENT_FLOW_LINE_155_26B65895, response
            ),
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
        lines = [
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_171_0611725A(query),
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_171_96D52036(page),
            "",
        ]
        for index, item in enumerate(items, start=1):
            if item.is_professional:
                suffix = bot_3_clients_rendering_text.CLIENT_FLOW_LINE_174_7216E7C9
            else:
                suffix = f" | {item.membership_label}" if item.membership_label else ""
            lines.append(f"{index}. {item.full_name}{suffix}")
        return "\n".join(lines)

    @staticmethod
    def _render_membership_list_text(title: str, response: MembershipListResponse) -> str:
        lines = [
            title,
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_182_7F5B56A5(response.page),
            "",
        ]
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
        lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_200_76304C27(card.phone))
    if card.status:
        lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_202_0C1B5454(card.status))
    if card.groups:
        lines.append(
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_204_4110D7E9
            + ", ".join(format_client_group(group) for group in card.groups)
        )
    if card.is_professional:
        comment = f": {card.professional_comment}" if card.professional_comment else ""
        lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_207_15E8B16D(comment))
    if card.warning:
        lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_209_9FB41F94(card.warning))
    for membership in card.current_memberships:
        lines.append(
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_212_1735BCE3(
                membership.type_label,
                membership.purchase_date.strftime("%d.%m.%Y"),
                membership.payment_date.strftime("%d.%m.%Y"),
            )
        )
        if membership.expiration_date is not None:
            lines.append(
                bot_3_clients_rendering_text.CLIENT_FLOW_LINE_218_1D91AA1E(
                    membership.expiration_date.strftime("%d.%m.%Y")
                )
            )
        if membership.coverage_kind == "AllGroups":
            reporting_group = next(
                (target.group_name for target in membership.target_groups if target.position == 0),
                None,
            )
            if reporting_group:
                lines.append(
                    bot_3_clients_rendering_text.CLIENT_FLOW_LINE_225_EC96BC1B(reporting_group)
                )
            else:
                lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_227_CA7E4776)
        elif membership.target_groups:
            lines.append(
                bot_3_clients_rendering_text.CLIENT_FLOW_LINE_229_2DEB9837(
                    format_target_groups(membership.target_groups)
                )
            )
        if membership.entitlement_state == "LegacyTargetMissing":
            lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_231_7CBA89CC)
    if card.attendance_history:
        lines.append(bot_3_clients_rendering_text.CLIENT_FLOW_LINE_233_8F049FB2)
        for item in card.attendance_history[:5]:
            marker = (
                bot_3_clients_rendering_text.CLIENT_FLOW_LINE_235_FF13DE89
                if item.is_present
                else bot_3_clients_rendering_text.CLIENT_FLOW_LINE_235_CD2E8AD3
            )
            lines.append(
                f"- {item.training_date.strftime('%d.%m.%Y')} | {item.group_name} | {marker}"
            )
    return "\n".join(lines)


def format_target_groups(target_groups: list[Any]) -> str:
    if not target_groups:
        return ""

    return ", ".join(
        f"{target.position + 1}. {target.group_name}"
        + (
            bot_3_clients_rendering_text.CLIENT_FLOW_LINE_248_AE8C7C86
            if target.position == 0
            else ""
        )
        for target in sorted(target_groups, key=lambda target: target.position)
    )
