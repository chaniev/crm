from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from gym_crm_bot.config import Settings
from gym_crm_bot.core.attendance_flow import AttendanceFlow
from gym_crm_bot.core.client_flow import ClientFlow
from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import DialogStateStore
from gym_crm_bot.core.idempotency import build_request_id
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import (
    CrmClientError,
    CrmMustChangePasswordError,
    CrmUserInactiveError,
    CrmUserNotConfiguredError,
)
from gym_crm_bot.resources.callbacks import decode_callback
from gym_crm_bot.resources.keyboards import render_menu_keyboard
from gym_crm_bot.resources.messages import (
    INACTIVE_USER_MESSAGE,
    MUST_CHANGE_PASSWORD_MESSAGE,
    known_user_id_message,
    unknown_user_message,
)
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


class BotService:
    def __init__(
        self,
        *,
        settings: Settings,
        crm_client: CrmBotApiClient,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._crm_client = crm_client
        self._state_store = DialogStateStore(
            settings=settings,
            session_factory=session_factory,
        )
        self._error_mapper = CrmErrorMapper(crm_client)
        self._attendance = AttendanceFlow(
            crm_client=crm_client,
            state_store=self._state_store,
            error_mapper=self._error_mapper,
        )
        self._clients = ClientFlow(
            crm_client=crm_client,
            state_store=self._state_store,
            error_mapper=self._error_mapper,
        )

    async def handle_event(self, event: NormalizedTelegramEvent) -> BotResponse:
        if event.kind == "command":
            return await self._handle_command(event)
        if event.kind == "callback":
            return await self._handle_callback(event)
        if event.kind == "text":
            return await self._clients.handle_text(event)
        return BotResponse(text="Используйте /start или кнопки меню.")

    async def _handle_command(self, event: NormalizedTelegramEvent) -> BotResponse:
        if event.command == "start":
            return await self._show_menu(event, reset_state=True)
        if event.command == "id":
            return await self._show_telegram_id(event)
        return BotResponse(text="Поддерживаются команды /start и /id.")

    async def _handle_callback(self, event: NormalizedTelegramEvent) -> BotResponse:
        payload = decode_callback(event.callback_data or "")
        action = payload.action

        if action == "menu":
            menu_code = payload.parts[0] if payload.parts else "root"
            return await self._handle_menu_callback(event, menu_code)
        if action == "adt" and payload.parts:
            return await self._attendance.select_date(event, payload.parts[0])
        if action == "agr" and payload.parts:
            return await self._attendance.select_group(event, payload.parts[0])
        if action == "atg" and payload.parts:
            return await self._attendance.toggle_mark(event, payload.parts[0])
        if action == "asv":
            return await self._attendance.save(event)
        if action == "srp" and payload.parts:
            return await self._clients.paginate_search(event, int(payload.parts[0]))
        if action == "ccd" and payload.parts:
            return await self._clients.show_card(
                event,
                UUID(payload.parts[0]),
                replace_existing=True,
            )
        if action == "mlp" and len(payload.parts) == 2:
            return await self._clients.show_memberships(
                event,
                list_code=payload.parts[0],
                page=int(payload.parts[1]),
                replace_existing=True,
            )
        return BotResponse(text="Команда не поддерживается.", replace_existing=True)

    async def _handle_menu_callback(
        self,
        event: NormalizedTelegramEvent,
        menu_code: str,
    ) -> BotResponse:
        if menu_code == "root":
            return await self._show_menu(event, reset_state=True)
        if menu_code == "attendance":
            return await self._attendance.start(event)
        if menu_code == "client_search":
            return await self._clients.start_search(event)
        if menu_code == "expiring_memberships":
            return await self._clients.show_memberships(
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
            return await self._error_mapper.map(exc, event)

        if reset_state:
            await self._state_store.clear_all(event)

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
            return await self._error_mapper.map(exc, event)

        return BotResponse(text=known_user_id_message(event.platform_user_id))


__all__ = ["BotResponse", "BotService"]
