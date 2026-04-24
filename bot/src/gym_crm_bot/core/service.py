from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from aiogram.types import InlineKeyboardMarkup
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.core.idempotency import build_mutation_idempotency_key, build_request_id
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import (
    CrmClientError,
    CrmForbiddenError,
    CrmIdempotencyConflictError,
    CrmMustChangePasswordError,
    CrmTemporaryError,
    CrmUserInactiveError,
    CrmUserNotConfiguredError,
    CrmValidationError,
)
from gym_crm_bot.crm.models import AttendanceMarkRequest, ClientCardResponse, MembershipListResponse
from gym_crm_bot.resources.callbacks import decode_callback
from gym_crm_bot.resources.keyboards import (
    render_attendance_dates_keyboard,
    render_attendance_groups_keyboard,
    render_attendance_roster_keyboard,
    render_membership_list_keyboard,
    render_menu_keyboard,
    render_payment_confirmation_keyboard,
    render_search_results_keyboard,
)
from gym_crm_bot.resources.messages import (
    EMPTY_GROUPS_MESSAGE,
    EMPTY_SEARCH_RESULTS_MESSAGE,
    EXPIRING_EMPTY_MESSAGE,
    FORBIDDEN_MESSAGE,
    INACTIVE_USER_MESSAGE,
    MUST_CHANGE_PASSWORD_MESSAGE,
    NO_ASSIGNED_GROUPS_MESSAGE,
    PAYMENT_CONFIRM_MESSAGE,
    SEARCH_PROMPT_MESSAGE,
    TEMPORARY_ERROR_MESSAGE,
    UNPAID_EMPTY_MESSAGE,
    VALIDATION_ERROR_PREFIX,
    known_user_id_message,
    unknown_user_message,
)
from gym_crm_bot.storage.db import session_scope
from gym_crm_bot.storage.repositories import ConversationStateRepository
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent

ATTENDANCE_SCENARIO = "attendance"
SEARCH_SCENARIO = "client_search"
MEMBERSHIP_SCENARIO = "membership_list"
STATEFUL_SCENARIOS = (ATTENDANCE_SCENARIO, SEARCH_SCENARIO, MEMBERSHIP_SCENARIO)
PAGE_SIZE = 5


@dataclass(slots=True)
class BotResponse:
    text: str
    reply_markup: InlineKeyboardMarkup | None = None
    replace_existing: bool = False


class BotService:
    def __init__(
        self,
        *,
        settings: Settings,
        crm_client: CrmBotApiClient,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._settings = settings
        self._crm_client = crm_client
        self._session_factory = session_factory

    async def handle_event(self, event: NormalizedTelegramEvent) -> BotResponse:
        if event.kind == "command":
            return await self._handle_command(event)
        if event.kind == "callback":
            return await self._handle_callback(event)
        if event.kind == "text":
            return await self._handle_text(event)
        return BotResponse(text="Используйте /start или кнопки меню.")

    async def _handle_command(self, event: NormalizedTelegramEvent) -> BotResponse:
        if event.command == "start":
            return await self._show_menu(event, reset_state=True)
        if event.command == "id":
            return await self._show_telegram_id(event)
        return BotResponse(text="Поддерживаются команды /start и /id.")

    async def _handle_text(self, event: NormalizedTelegramEvent) -> BotResponse:
        search_state = await self._get_state(event, SEARCH_SCENARIO)
        if search_state is None:
            return BotResponse(text="Используйте /start или кнопки меню.")

        query = (event.text or "").strip()
        if not query:
            return BotResponse(text=SEARCH_PROMPT_MESSAGE)

        return await self._search_clients(event, query=query, page=1, replace_existing=False)

    async def _handle_callback(self, event: NormalizedTelegramEvent) -> BotResponse:
        payload = decode_callback(event.callback_data or "")
        action = payload.action

        if action == "menu":
            menu_code = payload.parts[0] if payload.parts else "root"
            return await self._handle_menu_callback(event, menu_code)
        if action == "adt" and payload.parts:
            return await self._select_attendance_date(event, payload.parts[0])
        if action == "agr" and payload.parts:
            return await self._select_attendance_group(event, payload.parts[0])
        if action == "atg" and payload.parts:
            return await self._toggle_attendance_mark(event, payload.parts[0])
        if action == "asv":
            return await self._save_attendance(event)
        if action == "srp" and payload.parts:
            return await self._paginate_search(event, int(payload.parts[0]))
        if action == "ccd" and payload.parts:
            return await self._show_client_card(
                event,
                UUID(payload.parts[0]),
                replace_existing=True,
            )
        if action == "mlp" and len(payload.parts) == 2:
            return await self._show_memberships(
                event,
                list_code=payload.parts[0],
                page=int(payload.parts[1]),
                replace_existing=True,
            )
        if action == "mpc" and payload.parts:
            return await self._confirm_payment(event, UUID(payload.parts[0]))
        if action == "mpy" and payload.parts:
            return await self._mark_payment(event, UUID(payload.parts[0]))
        return BotResponse(text="Команда не поддерживается.", replace_existing=True)

    async def _handle_menu_callback(
        self,
        event: NormalizedTelegramEvent,
        menu_code: str,
    ) -> BotResponse:
        if menu_code == "root":
            return await self._show_menu(event, reset_state=True)
        if menu_code == "attendance":
            return await self._start_attendance(event)
        if menu_code == "client_search":
            return await self._start_search(event)
        if menu_code == "expiring_memberships":
            return await self._show_memberships(
                event,
                list_code=menu_code,
                page=1,
                replace_existing=True,
            )
        if menu_code == "unpaid_memberships":
            return await self._show_memberships(
                event,
                list_code=menu_code,
                page=1,
                replace_existing=True,
            )
        return await self._show_menu(event, reset_state=False)

    async def _show_menu(self, event: NormalizedTelegramEvent, *, reset_state: bool) -> BotResponse:
        identity = event.identity
        try:
            context = await self._crm_client.resolve_session(
                identity,
                request_id=build_request_id(),
            )
            menu = await self._crm_client.get_menu(identity, request_id=build_request_id())
        except CrmUserNotConfiguredError:
            return BotResponse(text=unknown_user_message(event.platform_user_id))
        except CrmMustChangePasswordError:
            return BotResponse(text=MUST_CHANGE_PASSWORD_MESSAGE)
        except CrmUserInactiveError:
            return BotResponse(text=INACTIVE_USER_MESSAGE)
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event)

        if reset_state:
            await self._clear_states(event)

        return BotResponse(
            text=f"{context.display_name}, выберите действие.",
            reply_markup=render_menu_keyboard(menu),
            replace_existing=not reset_state and event.kind == "callback",
        )

    async def _show_telegram_id(self, event: NormalizedTelegramEvent) -> BotResponse:
        try:
            await self._crm_client.resolve_session(event.identity, request_id=build_request_id())
        except CrmUserNotConfiguredError:
            return BotResponse(text=unknown_user_message(event.platform_user_id))
        except CrmMustChangePasswordError:
            return BotResponse(text=MUST_CHANGE_PASSWORD_MESSAGE)
        except CrmUserInactiveError:
            return BotResponse(text=INACTIVE_USER_MESSAGE)
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event)

        return BotResponse(text=known_user_id_message(event.platform_user_id))

    async def _start_attendance(self, event: NormalizedTelegramEvent) -> BotResponse:
        try:
            context = await self._crm_client.resolve_session(
                event.identity,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="attendance_menu")

        await self._clear_states(event)
        await self._save_state(
            event,
            ATTENDANCE_SCENARIO,
            {"step": "select_date", "role": context.role},
        )
        return BotResponse(
            text="Выберите дату тренировки.",
            reply_markup=render_attendance_dates_keyboard(context.role, datetime.now(UTC).date()),
            replace_existing=True,
        )

    async def _select_attendance_date(
        self,
        event: NormalizedTelegramEvent,
        training_date_value: str,
    ) -> BotResponse:
        state = await self._get_state(event, ATTENDANCE_SCENARIO)
        if state is None:
            return await self._start_attendance(event)

        training_date = date.fromisoformat(training_date_value)
        try:
            response = await self._crm_client.list_attendance_groups(
                event.identity,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="attendance_groups")

        if not response.items:
            return BotResponse(
                text=(
                    NO_ASSIGNED_GROUPS_MESSAGE
                    if state.get("role") == "Coach"
                    else EMPTY_GROUPS_MESSAGE
                ),
                replace_existing=True,
            )

        await self._save_state(
            event,
            ATTENDANCE_SCENARIO,
            {
                "step": "select_group",
                "role": state.get("role"),
                "training_date": training_date.isoformat(),
            },
        )
        groups = [(item.id, item.name) for item in response.items]
        return BotResponse(
            text=f"Дата: {training_date.strftime('%d.%m.%Y')}. Выберите группу.",
            reply_markup=render_attendance_groups_keyboard(groups),
            replace_existing=True,
        )

    async def _select_attendance_group(
        self,
        event: NormalizedTelegramEvent,
        group_id_value: str,
    ) -> BotResponse:
        state = await self._get_state(event, ATTENDANCE_SCENARIO)
        if state is None or "training_date" not in state:
            return await self._start_attendance(event)

        group_id = UUID(group_id_value)
        training_date = date.fromisoformat(state["training_date"])
        try:
            roster = await self._crm_client.get_attendance_roster(
                event.identity,
                group_id=group_id,
                training_date=training_date,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="attendance_roster")

        marks = [
            {
                "client_id": str(client.id),
                "full_name": client.full_name,
                "is_present": client.is_present,
                "warning": client.warning,
                "has_unpaid_membership": client.has_unpaid_membership,
            }
            for client in roster.clients
        ]

        await self._save_state(
            event,
            ATTENDANCE_SCENARIO,
            {
                "step": "draft",
                "training_date": training_date.isoformat(),
                "group_id": str(roster.group.id),
                "group_name": roster.group.name,
                "marks": marks,
            },
        )
        return BotResponse(
            text=self._render_roster_text(roster.group.name, training_date, marks),
            reply_markup=render_attendance_roster_keyboard(
                [(UUID(item["client_id"]), item["full_name"], item["is_present"]) for item in marks]
            ),
            replace_existing=True,
        )

    async def _toggle_attendance_mark(
        self,
        event: NormalizedTelegramEvent,
        client_id: str,
    ) -> BotResponse:
        state = await self._require_attendance_draft(event)
        if state is None:
            return await self._start_attendance(event)

        updated_marks = []
        for item in state["marks"]:
            is_present = item["is_present"]
            if item["client_id"] == client_id:
                is_present = not is_present
            updated_marks.append({**item, "is_present": is_present})

        state["marks"] = updated_marks
        await self._save_state(event, ATTENDANCE_SCENARIO, state)

        training_date = date.fromisoformat(state["training_date"])
        return BotResponse(
            text=self._render_roster_text(state["group_name"], training_date, updated_marks),
            reply_markup=render_attendance_roster_keyboard(
                [
                    (UUID(item["client_id"]), item["full_name"], item["is_present"])
                    for item in updated_marks
                ]
            ),
            replace_existing=True,
        )

    async def _save_attendance(self, event: NormalizedTelegramEvent) -> BotResponse:
        state = await self._require_attendance_draft(event)
        if state is None:
            return await self._start_attendance(event)

        marks = [
            AttendanceMarkRequest(clientId=UUID(item["client_id"]), isPresent=item["is_present"])
            for item in state["marks"]
        ]
        try:
            response = await self._crm_client.save_attendance(
                event.identity,
                group_id=UUID(state["group_id"]),
                training_date=date.fromisoformat(state["training_date"]),
                marks=marks,
                request_id=build_request_id(),
                idempotency_key=build_mutation_idempotency_key(
                    action="attendance",
                    platform_user_id=event.platform_user_id,
                    update_id=event.update_id,
                    target=state["group_id"],
                ),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="attendance_save")

        await self._clear_states(event)
        warnings = "\n".join(f"- {item}" for item in response.warnings)
        summary = (
            f"Посещения сохранены.\n"
            f"Группа: {response.group_name}\n"
            f"Дата: {response.training_date.strftime('%d.%m.%Y')}\n"
            f"Отмечено: {response.marked_count}\n"
            f"Были: {response.present_count}\n"
            f"Не были: {response.absent_count}"
        )
        if warnings:
            summary += f"\nПредупреждения:\n{warnings}"
        return BotResponse(text=summary, replace_existing=True)

    async def _start_search(self, event: NormalizedTelegramEvent) -> BotResponse:
        await self._clear_states(event)
        await self._save_state(event, SEARCH_SCENARIO, {"step": "await_query"})
        return BotResponse(text=SEARCH_PROMPT_MESSAGE, replace_existing=True)

    async def _search_clients(
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
            return await self._map_crm_error(exc, event, audit_reason="client_search")

        await self._save_state(
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

    async def _paginate_search(self, event: NormalizedTelegramEvent, page: int) -> BotResponse:
        state = await self._get_state(event, SEARCH_SCENARIO)
        if state is None or "query" not in state:
            return await self._start_search(event)
        return await self._search_clients(
            event,
            query=state["query"],
            page=page,
            replace_existing=True,
        )

    async def _show_client_card(
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
            return await self._map_crm_error(exc, event, audit_reason="client_card")
        return BotResponse(text=self._render_client_card(card), replace_existing=replace_existing)

    async def _show_memberships(
        self,
        event: NormalizedTelegramEvent,
        *,
        list_code: str,
        page: int,
        replace_existing: bool,
    ) -> BotResponse:
        loader = (
            self._crm_client.list_expiring_memberships
            if list_code == "expiring_memberships"
            else self._crm_client.list_unpaid_memberships
        )
        try:
            response = await loader(
                event.identity,
                page=page,
                page_size=PAGE_SIZE,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason=list_code)

        await self._save_state(
            event,
            MEMBERSHIP_SCENARIO,
            {"list_code": list_code, "page": response.page},
        )

        if not response.items:
            empty_text = (
                EXPIRING_EMPTY_MESSAGE
                if list_code == "expiring_memberships"
                else UNPAID_EMPTY_MESSAGE
            )
            return BotResponse(text=empty_text, replace_existing=replace_existing)

        title = (
            "Заканчивающиеся абонементы"
            if list_code == "expiring_memberships"
            else "Неоплаченные абонементы"
        )
        allow_mark_payment = list_code == "unpaid_memberships"
        return BotResponse(
            text=self._render_membership_list_text(title, response),
            reply_markup=render_membership_list_keyboard(
                response.items,
                page=response.page,
                has_next_page=response.has_next_page,
                allow_mark_payment=allow_mark_payment,
                list_code=list_code,
            ),
            replace_existing=replace_existing,
        )

    async def _confirm_payment(
        self,
        event: NormalizedTelegramEvent,
        client_id: UUID,
    ) -> BotResponse:
        try:
            card = await self._crm_client.get_client_card(
                event.identity,
                client_id=client_id,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="payment_confirm")

        membership = card.current_membership
        membership_label = membership.type_label if membership is not None else "текущий абонемент"
        text = PAYMENT_CONFIRM_MESSAGE.format(full_name=card.full_name)
        text += f"\nАбонемент: {membership_label}"
        return BotResponse(
            text=text,
            reply_markup=render_payment_confirmation_keyboard(client_id),
            replace_existing=True,
        )

    async def _mark_payment(self, event: NormalizedTelegramEvent, client_id: UUID) -> BotResponse:
        try:
            result = await self._crm_client.mark_membership_payment(
                event.identity,
                client_id=client_id,
                request_id=build_request_id(),
                idempotency_key=build_mutation_idempotency_key(
                    action="mark_payment",
                    platform_user_id=event.platform_user_id,
                    update_id=event.update_id,
                    target=str(client_id),
                ),
            )
        except CrmClientError as exc:
            return await self._map_crm_error(exc, event, audit_reason="mark_payment")

        return BotResponse(
            text=(
                f"Оплата отмечена.\n"
                f"Клиент: {result.full_name}\n"
                f"Абонемент: {result.membership_label}\n"
                f"Статус: {result.status}"
            ),
            replace_existing=True,
        )

    async def _map_crm_error(
        self,
        error: CrmClientError,
        event: NormalizedTelegramEvent,
        *,
        audit_reason: str | None = None,
    ) -> BotResponse:
        if audit_reason is not None and isinstance(error, CrmForbiddenError):
            try:
                await self._crm_client.audit_access_denied(
                    event.identity,
                    request_id=build_request_id(),
                    reason=audit_reason,
                )
            except CrmClientError:
                pass

        if isinstance(error, CrmUserNotConfiguredError):
            return BotResponse(text=unknown_user_message(event.platform_user_id))
        if isinstance(error, CrmUserInactiveError):
            return BotResponse(text=INACTIVE_USER_MESSAGE)
        if isinstance(error, CrmMustChangePasswordError):
            return BotResponse(text=MUST_CHANGE_PASSWORD_MESSAGE)
        if isinstance(error, CrmForbiddenError):
            return BotResponse(text=FORBIDDEN_MESSAGE, replace_existing=event.kind == "callback")
        if isinstance(error, CrmValidationError):
            return BotResponse(
                text=f"{VALIDATION_ERROR_PREFIX} {error}",
                replace_existing=event.kind == "callback",
            )
        if isinstance(error, CrmIdempotencyConflictError):
            return BotResponse(
                text="Запрос уже обрабатывается. Обновите меню и проверьте результат.",
                replace_existing=event.kind == "callback",
            )
        if isinstance(error, CrmTemporaryError):
            return BotResponse(
                text=TEMPORARY_ERROR_MESSAGE,
                replace_existing=event.kind == "callback",
            )
        return BotResponse(text=str(error), replace_existing=event.kind == "callback")

    async def _require_attendance_draft(
        self,
        event: NormalizedTelegramEvent,
    ) -> dict[str, Any] | None:
        state = await self._get_state(event, ATTENDANCE_SCENARIO)
        if state is None or state.get("step") != "draft":
            return None
        return state

    async def _get_state(
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

    async def _save_state(
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

    async def _clear_states(self, event: NormalizedTelegramEvent) -> None:
        async with session_scope(self._session_factory) as session:
            repo = ConversationStateRepository(session)
            for scenario in STATEFUL_SCENARIOS:
                await repo.clear(
                    platform="Telegram",
                    chat_id=event.chat_id,
                    platform_user_id=event.platform_user_id,
                    scenario=scenario,
                )

    @staticmethod
    def _render_roster_text(
        group_name: str,
        training_date: date,
        marks: list[dict[str, Any]],
    ) -> str:
        if not marks:
            return f"Группа {group_name} на {training_date.strftime('%d.%m.%Y')}: список пуст."
        lines = [f"Группа: {group_name}", f"Дата: {training_date.strftime('%d.%m.%Y')}", ""]
        for item in marks:
            marker = "Был" if item["is_present"] else "Не был"
            line = f"{item['full_name']}: {marker}"
            if item.get("warning"):
                line += f" ({item['warning']})"
            lines.append(line)
        return "\n".join(lines)

    @staticmethod
    def _render_search_results_text(query: str, items: list[Any], page: int) -> str:
        lines = [f"Результаты поиска: {query}", f"Страница: {page}", ""]
        for index, item in enumerate(items, start=1):
            suffix = f" | {item.membership_label}" if item.membership_label else ""
            lines.append(f"{index}. {item.full_name}{suffix}")
        return "\n".join(lines)

    @staticmethod
    def _render_client_card(card: ClientCardResponse) -> str:
        lines = [card.full_name]
        if card.phone:
            lines.append(f"Телефон: {card.phone}")
        if card.status:
            lines.append(f"Статус: {card.status}")
        if card.groups:
            lines.append(f"Группы: {', '.join(card.groups)}")
        if card.warning:
            lines.append(f"Предупреждение: {card.warning}")
        if card.current_membership:
            membership = card.current_membership
            lines.append(
                "Абонемент: "
                f"{membership.type_label}, "
                f"покупка {membership.purchase_date.strftime('%d.%m.%Y')}, "
                f"оплачен: {'да' if membership.is_paid else 'нет'}"
            )
            if membership.expiration_date is not None:
                lines.append(f"Действует до: {membership.expiration_date.strftime('%d.%m.%Y')}")
        if card.attendance_history:
            lines.append("История посещений:")
            for item in card.attendance_history[:5]:
                marker = "Был" if item.is_present else "Не был"
                lines.append(
                    f"- {item.training_date.strftime('%d.%m.%Y')} | {item.group_name} | {marker}"
                )
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
            if item.is_paid is not None:
                details.append("оплачен" if item.is_paid else "не оплачен")
            suffix = f" | {' | '.join(details)}" if details else ""
            lines.append(f"{index}. {item.full_name}{suffix}")
        return "\n".join(lines)


__all__ = ["BotResponse", "BotService"]
