from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import ATTENDANCE_SCENARIO, DialogStateStore
from gym_crm_bot.core.idempotency import build_mutation_idempotency_key, build_request_id
from gym_crm_bot.core.rendering import format_group_schedule
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmClientError
from gym_crm_bot.crm.models import AttendanceGroup, AttendanceLesson, AttendanceMarkRequest
from gym_crm_bot.resources import bot_2_attendance as bot_2_attendance_text
from gym_crm_bot.resources.keyboards import (
    render_attendance_dates_keyboard,
    render_attendance_groups_keyboard,
    render_attendance_roster_keyboard,
)
from gym_crm_bot.resources.messages import EMPTY_GROUPS_MESSAGE, NO_ASSIGNED_GROUPS_MESSAGE
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


class AttendanceFlow:
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

    async def start(self, event: NormalizedTelegramEvent) -> BotResponse:
        try:
            menu = await self._crm_client.get_menu(
                event.identity,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="attendance_menu")

        date_window = menu.attendance_date_window
        await self._state_store.clear_all(event)
        await self._state_store.save(
            event,
            ATTENDANCE_SCENARIO,
            {
                "step": "select_date",
                "role": menu.user.role,
                "today": date_window.today.isoformat(),
                "min_training_date": (
                    date_window.min_training_date.isoformat()
                    if date_window.min_training_date is not None
                    else None
                ),
                "max_training_date": date_window.max_training_date.isoformat(),
            },
        )
        return BotResponse(
            text=bot_2_attendance_text.ATTENDANCE_FLOW_LINE_63_62EAB7BE,
            reply_markup=render_attendance_dates_keyboard(
                today=date_window.today,
                min_training_date=date_window.min_training_date,
                max_training_date=date_window.max_training_date,
            ),
            replace_existing=True,
        )

    async def select_date(
        self,
        event: NormalizedTelegramEvent,
        training_date_value: str,
    ) -> BotResponse:
        state = await self._state_store.get(event, ATTENDANCE_SCENARIO)
        if state is None:
            return await self.start(event)

        training_date = date.fromisoformat(training_date_value)
        try:
            response = await self._crm_client.list_attendance_lessons(
                event.identity,
                training_date=training_date,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="attendance_groups")

        if not response.items:
            return BotResponse(
                text=(
                    NO_ASSIGNED_GROUPS_MESSAGE
                    if state.get("role") == "Coach"
                    else EMPTY_GROUPS_MESSAGE
                ),
                replace_existing=True,
            )

        await self._state_store.save(
            event,
            ATTENDANCE_SCENARIO,
            {
                "step": "select_lesson",
                "role": state.get("role"),
                "training_date": training_date.isoformat(),
            },
        )
        groups = [(item.id, item.name) for item in response.items]
        return BotResponse(
            text=render_attendance_groups_text(training_date, response.items),
            reply_markup=render_attendance_groups_keyboard(groups),
            replace_existing=True,
        )

    async def select_group(
        self,
        event: NormalizedTelegramEvent,
        group_id_value: str,
    ) -> BotResponse:
        state = await self._state_store.get(event, ATTENDANCE_SCENARIO)
        if state is None or "training_date" not in state:
            return await self.start(event)

        lesson_occurrence_id = UUID(group_id_value)
        training_date = date.fromisoformat(state["training_date"])
        try:
            roster = await self._crm_client.get_attendance_lesson_roster(
                event.identity,
                lesson_occurrence_id=lesson_occurrence_id,
                lesson_date=training_date,
                request_id=build_request_id(),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="attendance_roster")

        marks = [
            {
                "client_id": str(client.id),
                "full_name": client.full_name,
                "is_present": client.is_present,
                "warning": client.warning,
            }
            for client in roster.clients
        ]
        keyboard_marks = [
            (client.id, client.full_name, client.is_present) for client in roster.clients
        ]

        await self._state_store.save(
            event,
            ATTENDANCE_SCENARIO,
            {
                "step": "draft",
                "training_date": training_date.isoformat(),
                "lesson_occurrence_id": str(lesson_occurrence_id),
                "group_id": str(roster.group.id),
                "group_name": roster.group.name,
                "marks": marks,
            },
        )
        return BotResponse(
            text=self._render_roster_text(roster.group.name, training_date, marks),
            reply_markup=render_attendance_roster_keyboard(keyboard_marks),
            replace_existing=True,
        )

    async def toggle_mark(
        self,
        event: NormalizedTelegramEvent,
        client_id: str,
    ) -> BotResponse:
        state = await self._require_draft(event)
        if state is None:
            return await self.start(event)

        updated_marks = []
        for item in state["marks"]:
            is_present = item["is_present"]
            if item["client_id"] == client_id:
                is_present = not is_present
            updated_marks.append({**item, "is_present": is_present})

        state["marks"] = updated_marks
        await self._state_store.save(event, ATTENDANCE_SCENARIO, state)

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

    async def save(self, event: NormalizedTelegramEvent) -> BotResponse:
        state = await self._require_draft(event)
        if state is None:
            return await self.start(event)

        marks = [
            AttendanceMarkRequest(
                client_id=UUID(item["client_id"]),
                is_present=item["is_present"],
            )
            for item in state["marks"]
        ]
        try:
            training_date = date.fromisoformat(state["training_date"])
            target = state["lesson_occurrence_id"]
            response = await self._crm_client.save_lesson_attendance(
                event.identity,
                lesson_occurrence_id=UUID(target),
                lesson_date=training_date,
                marks=marks,
                request_id=build_request_id(),
                idempotency_key=build_mutation_idempotency_key(
                    action="attendance",
                    platform_user_id=event.platform_user_id,
                    update_id=event.update_id,
                    target=target,
                ),
            )
        except CrmClientError as exc:
            return await self._error_mapper.map(exc, event, audit_reason="attendance_save")

        await self._state_store.clear_all(event)
        warnings = "\n".join(f"- {item}" for item in response.warnings)
        summary = bot_2_attendance_text.ATTENDANCE_FLOW_LINE_234_7E385447(
            response.group_name,
            response.training_date.strftime("%d.%m.%Y"),
            response.marked_count,
            response.present_count,
            response.absent_count,
        )
        if warnings:
            summary += bot_2_attendance_text.ATTENDANCE_FLOW_LINE_242_89CE99C4(warnings)
        return BotResponse(text=summary, replace_existing=True)

    async def _require_draft(self, event: NormalizedTelegramEvent) -> dict[str, Any] | None:
        state = await self._state_store.get(event, ATTENDANCE_SCENARIO)
        if state is None or state.get("step") != "draft":
            return None
        if not state.get("lesson_occurrence_id") or not state.get("training_date"):
            return None
        return state

    @staticmethod
    def _render_groups_text(
        training_date: date,
        groups: list[AttendanceGroup] | list[AttendanceLesson],
    ) -> str:
        return render_attendance_groups_text(training_date, groups)

    @staticmethod
    def _render_roster_text(
        group_name: str,
        training_date: date,
        marks: list[dict[str, Any]],
    ) -> str:
        if not marks:
            return bot_2_attendance_text.ATTENDANCE_FLOW_LINE_267_56B0987A(
                group_name, training_date.strftime("%d.%m.%Y")
            )
        lines = [
            bot_2_attendance_text.ATTENDANCE_FLOW_LINE_268_AA9476A6(group_name),
            bot_2_attendance_text.ATTENDANCE_FLOW_LINE_268_A8949993(
                training_date.strftime("%d.%m.%Y")
            ),
            "",
        ]
        for item in marks:
            marker = (
                bot_2_attendance_text.ATTENDANCE_FLOW_LINE_270_FF13DE89
                if item["is_present"]
                else bot_2_attendance_text.ATTENDANCE_FLOW_LINE_270_CD2E8AD3
            )
            line = f"{item['full_name']}: {marker}"
            if item.get("warning"):
                line += f" ({item['warning']})"
            lines.append(line)
        return "\n".join(lines)


def render_attendance_groups_text(
    training_date: date,
    groups: list[AttendanceGroup] | list[AttendanceLesson],
) -> str:
    lines = [
        bot_2_attendance_text.ATTENDANCE_FLOW_LINE_282_8951FBCA(training_date.strftime("%d.%m.%Y"))
    ]
    for group in groups:
        if isinstance(group, AttendanceLesson):
            details = [
                bot_2_attendance_text.ATTENDANCE_FLOW_LINE_286_A3486BF2(group.start_time),
                bot_2_attendance_text.ATTENDANCE_FLOW_LINE_287_9B75002F(group.duration_minutes),
                group.hall_name,
                group.branch_name,
            ]
            if group.effective_trainers:
                trainer_names = ", ".join(
                    trainer.display_name for trainer in group.effective_trainers
                )
                details.append(
                    bot_2_attendance_text.ATTENDANCE_FLOW_LINE_295_12B8B72F(trainer_names)
                )
            if group.status == "Cancelled":
                details.append(bot_2_attendance_text.ATTENDANCE_FLOW_LINE_297_8A097230)
            lines.append(f"{group.group_name}: {' · '.join(details)}")
            continue

        schedule = format_group_schedule(
            group.weekdays,
            group.duration_minutes,
            group.training_start_time,
        )
        lines.append(f"{group.name}: {schedule}" if schedule else group.name)
    return "\n".join(lines)
