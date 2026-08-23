from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

import pytest

from gym_crm_bot.core.attendance_flow import AttendanceFlow
from gym_crm_bot.core.crm_error_mapping import CrmErrorMapper
from gym_crm_bot.core.dialog_state import (
    ATTENDANCE_SCENARIO,
    MEMBERSHIP_SCENARIO,
    SEARCH_SCENARIO,
)
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import AttendanceSaveResponse
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
class FlakyAttendanceCrmClient:
    group_id: UUID = UUID("00000000-0000-0000-0000-000000000021")
    client_id: UUID = UUID("00000000-0000-0000-0000-000000000031")
    failures: int = 1
    request_ids: list[str] = field(default_factory=list)
    idempotency_keys: list[str] = field(default_factory=list)

    async def save_attendance(  # noqa: ANN001, PLR0913
        self,
        identity,
        *,
        group_id: UUID,
        training_date: date,
        marks: list[object],
        request_id: str,
        idempotency_key: str,
    ) -> AttendanceSaveResponse:
        self.request_ids.append(request_id)
        self.idempotency_keys.append(idempotency_key)
        if self.failures > 0:
            self.failures -= 1
            raise CrmTemporaryError("temporary attendance failure")
        return AttendanceSaveResponse(
            groupName="Группа",
            trainingDate=training_date,
            attendanceDateWindow={
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            markedCount=len(marks),
            presentCount=1,
            absentCount=0,
            warnings=[],
        )

    async def save_lesson_attendance(  # noqa: ANN001, PLR0913
        self,
        identity,
        *,
        lesson_occurrence_id: UUID,
        lesson_date: date,
        marks: list[object],
        request_id: str,
        idempotency_key: str,
    ) -> AttendanceSaveResponse:
        return await self.save_attendance(
            identity,
            group_id=lesson_occurrence_id,
            training_date=lesson_date,
            marks=marks,
            request_id=request_id,
            idempotency_key=idempotency_key,
        )


def _save_event() -> NormalizedTelegramEvent:
    return NormalizedTelegramEvent(
        update_id=920,
        event_key="callback:920",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind="callback",
        callback_data="asv",
    )


@pytest.mark.asyncio
async def test_save_error_retry_reuses_idempotency_and_cleans_only_after_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(["attendance-save-failed", "attendance-save-retry"])
    monkeypatch.setattr(
        "gym_crm_bot.core.attendance_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = FlakyAttendanceCrmClient()
    state_store = InMemoryDialogState()
    flow = AttendanceFlow(
        crm_client=crm_client,
        state_store=state_store,
        error_mapper=CrmErrorMapper(crm_client),
    )
    event = _save_event()
    draft = {
        "step": "draft",
        "training_date": "2026-05-13",
        "lesson_occurrence_id": str(crm_client.group_id),
        "group_id": str(crm_client.group_id),
        "group_name": "Группа",
        "marks": [
            {
                "client_id": str(crm_client.client_id),
                "full_name": "Петр Иванов",
                "is_present": True,
                "warning": None,
            }
        ],
    }
    await state_store.save(event, ATTENDANCE_SCENARIO, draft)
    await state_store.save(event, SEARCH_SCENARIO, {"step": "results", "query": "Петр"})
    await state_store.save(
        event,
        MEMBERSHIP_SCENARIO,
        {"list_code": "expiring_memberships", "page": 1},
    )

    failure = await flow.save(event)

    assert failure == BotResponse(text=TEMPORARY_ERROR_MESSAGE, replace_existing=True)
    assert await state_store.get(event, ATTENDANCE_SCENARIO) == draft
    assert await state_store.get(event, SEARCH_SCENARIO) is not None
    assert await state_store.get(event, MEMBERSHIP_SCENARIO) is not None

    success = await flow.save(event)

    assert success.text == (
        "Посещения сохранены.\nГруппа: Группа\nДата: 13.05.2026\nОтмечено: 1\nБыли: 1\nНе были: 0"
    )
    assert crm_client.request_ids == ["attendance-save-failed", "attendance-save-retry"]
    assert crm_client.idempotency_keys == [
        "tg:777:920:attendance:00000000-0000-0000-0000-000000000021",
        "tg:777:920:attendance:00000000-0000-0000-0000-000000000021",
    ]
    assert state_store.states == {}
