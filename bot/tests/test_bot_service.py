from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.config import Settings
from gym_crm_bot.core.attendance_flow import AttendanceFlow
from gym_crm_bot.core.client_flow import ClientFlow, format_client_group
from gym_crm_bot.core.dialog_state import ATTENDANCE_SCENARIO, DialogStateStore
from gym_crm_bot.core.service import BotService
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.errors import CrmUserNotConfiguredError
from gym_crm_bot.crm.models import (
    AttendanceDateWindow,
    AttendanceGroup,
    AttendanceGroupsResponse,
    AttendanceLesson,
    AttendanceLessonsResponse,
    AttendanceRosterResponse,
    AttendanceSaveResponse,
    BotUserContext,
    ClientCardMembership,
    ClientCardResponse,
    ClientGroupSummary,
    ClientListItem,
    ClientSearchResponse,
    MembershipListResponse,
    MenuItem,
    MenuResponse,
)
from gym_crm_bot.resources import keyboards
from gym_crm_bot.storage.models import Base
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


@dataclass
class FakeCrmClient:
    known_user: bool = True
    role: str = "Coach"
    menu_items: tuple[MenuItem, ...] = (MenuItem(code="attendance", title="Посещения"),)
    attendance_groups: tuple[AttendanceGroup, ...] = ()
    attendance_today: date = date(2026, 5, 13)
    attendance_min_training_date: date | None = date(2026, 5, 11)
    attendance_max_training_date: date = date(2026, 5, 13)

    async def resolve_session(self, identity, *, request_id: str):  # noqa: ANN001
        if not self.known_user:
            raise CrmUserNotConfiguredError("not configured")
        return BotUserContext(
            crm_user_id="00000000-0000-0000-0000-000000000001",
            display_name="Иван",
            role=self.role,
        )

    async def get_menu(self, identity, *, request_id: str):  # noqa: ANN001
        return MenuResponse(
            user=BotUserContext(
                crm_user_id="00000000-0000-0000-0000-000000000001",
                display_name="Иван",
                role=self.role,
            ),
            attendanceDateWindow=AttendanceDateWindow(
                today=self.attendance_today,
                minTrainingDate=self.attendance_min_training_date,
                maxTrainingDate=self.attendance_max_training_date,
            ),
            items=list(self.menu_items),
        )

    async def list_attendance_groups(self, identity, *, request_id: str):  # noqa: ANN001
        return AttendanceGroupsResponse(items=list(self.attendance_groups))

    async def list_attendance_lessons(  # noqa: ANN001
        self,
        identity,
        *,
        training_date: date,
        request_id: str,
    ):
        _ = training_date
        return AttendanceGroupsResponse(items=list(self.attendance_groups))

    async def audit_access_denied(  # noqa: ANN001
        self,
        identity,
        *,
        request_id: str,
        idempotency_key: str,
        reason: str,
    ) -> None:
        return None


@dataclass
class FakeAttendanceCrmClient:
    response: AttendanceSaveResponse

    async def save_attendance(  # noqa: PLR0913
        self,
        identity: object,
        *,
        group_id: UUID,
        training_date: date,
        marks: list[object],
        request_id: str,
        idempotency_key: str,
    ) -> AttendanceSaveResponse:
        return self.response

    async def save_lesson_attendance(  # noqa: ANN001, PLR0913
        self,
        identity: object,
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


@dataclass
class TranscriptCrmClient:
    request_ids: list[str] = field(default_factory=list)
    save_idempotency_keys: list[str] = field(default_factory=list)
    client_search_requests: list[tuple[str, int, int, str]] = field(default_factory=list)
    membership_list_requests: list[tuple[int, int, str]] = field(default_factory=list)
    group_id: UUID = UUID("00000000-0000-0000-0000-000000000021")
    first_client_id: UUID = UUID("00000000-0000-0000-0000-000000000031")
    second_client_id: UUID = UUID("00000000-0000-0000-0000-000000000032")

    async def resolve_session(self, identity, *, request_id: str):  # noqa: ANN001
        self.request_ids.append(request_id)
        return BotUserContext(
            crm_user_id="00000000-0000-0000-0000-000000000001",
            display_name="Иван",
            role="Coach",
        )

    async def get_menu(self, identity, *, request_id: str):  # noqa: ANN001
        self.request_ids.append(request_id)
        return MenuResponse(
            user=BotUserContext(
                crm_user_id="00000000-0000-0000-0000-000000000001",
                display_name="Иван",
                role="Coach",
            ),
            attendanceDateWindow=AttendanceDateWindow(
                today=date(2026, 5, 13),
                minTrainingDate=date(2026, 5, 11),
                maxTrainingDate=date(2026, 5, 13),
            ),
            items=[
                MenuItem(code="attendance", title="Посещения"),
                MenuItem(code="client_search", title="Поиск клиента"),
                MenuItem(code="expiring_memberships", title="Заканчивающиеся"),
            ],
        )

    async def list_attendance_groups(self, identity, *, request_id: str):  # noqa: ANN001
        self.request_ids.append(request_id)
        return AttendanceGroupsResponse(
            items=[
                AttendanceGroup(
                    id=self.group_id,
                    name="Группа",
                    trainingStartTime="19:00",
                    weekdays=[3],
                )
            ]
        )

    async def list_attendance_lessons(  # noqa: ANN001
        self,
        identity,
        *,
        training_date: date,
        request_id: str,
    ):
        _ = training_date
        return await self.list_attendance_groups(identity, request_id=request_id)

    async def get_attendance_roster(  # noqa: ANN001
        self,
        identity,
        *,
        group_id: UUID,
        training_date: date,
        request_id: str,
    ) -> AttendanceRosterResponse:
        self.request_ids.append(request_id)
        return AttendanceRosterResponse(
            groupId=group_id,
            groupName="Группа",
            trainingDate=training_date,
            attendanceDateWindow={
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            clients=[
                {
                    "id": str(self.first_client_id),
                    "fullName": "Петр Иванов",
                    "isPresent": False,
                    "membershipWarning": None,
                }
            ],
        )

    async def get_attendance_lesson_roster(  # noqa: ANN001
        self,
        identity,
        *,
        lesson_occurrence_id: UUID,
        lesson_date: date,
        request_id: str,
    ) -> AttendanceRosterResponse:
        return await self.get_attendance_roster(
            identity,
            group_id=lesson_occurrence_id,
            training_date=lesson_date,
            request_id=request_id,
        )

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
        self.save_idempotency_keys.append(idempotency_key)
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
        self.client_search_requests.append((query, page, page_size, request_id))
        if page == 1:
            return ClientSearchResponse(
                items=[
                    ClientListItem(
                        id=self.first_client_id,
                        fullName="Петр Иванов",
                        membershipLabel="Месячный",
                    )
                ],
                skip=0,
                take=page_size,
                hasMore=True,
            )
        return ClientSearchResponse(
            items=[ClientListItem(id=self.second_client_id, fullName="Петр Второй")],
            skip=page_size,
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
        return ClientCardResponse(
            id=client_id,
            fullName="Петр Второй",
            phone="+79990000000",
            currentMemberships=[
                {
                    "id": "00000000-0000-0000-0000-000000000099",
                    "saleId": "00000000-0000-0000-0000-000000000097",
                    "behaviorKind": "Term",
                    "membershipCatalogItemId": "00000000-0000-0000-0000-000000000098",
                    "membershipLabel": "Месячный",
                    "purchaseDate": "2026-05-01",
                    "paymentDate": "2026-05-01",
                    "expirationDate": "2026-06-01",
                    "pricingMode": "Catalog",
                    "grossAmount": 2000,
                    "catalogPrice": 2000,
                    "coverageKind": "TargetGroups",
                    "entitlementState": "Active",
                    "targetGroups": [
                        {
                            "groupId": "00000000-0000-0000-0000-000000000021",
                            "groupName": "Йога",
                            "branchId": "00000000-0000-0000-0000-000000000031",
                            "branchName": "Центр",
                            "position": 0,
                            "isActive": True,
                        }
                    ],
                }
            ],
        )

    async def list_expiring_memberships(  # noqa: ANN001
        self,
        identity,
        *,
        page: int,
        page_size: int,
        request_id: str,
    ) -> MembershipListResponse:
        self.request_ids.append(request_id)
        self.membership_list_requests.append((page, page_size, request_id))
        return MembershipListResponse(
            items=[
                ClientListItem(
                    id=self.second_client_id,
                    fullName="Петр Второй",
                    membershipLabel="Месячный",
                    membershipExpiresAt="2026-06-01",
                )
            ],
            page=page,
            pageSize=page_size,
            hasNextPage=page == 1,
        )

    async def audit_access_denied(  # noqa: ANN001
        self,
        identity,
        *,
        request_id: str,
        idempotency_key: str,
        reason: str,
    ) -> None:
        self.request_ids.append(request_id)


@dataclass
class SameGroupSameDayCrmClient:
    request_ids: list[str] = field(default_factory=list)
    roster_requests: list[tuple[UUID, date]] = field(default_factory=list)
    save_requests: list[tuple[UUID, date]] = field(default_factory=list)
    save_idempotency_keys: list[str] = field(default_factory=list)
    group_id: UUID = UUID("00000000-0000-0000-0000-000000000021")
    morning_lesson_id: UUID = UUID("10000000-0000-0000-0000-000000000001")
    evening_lesson_id: UUID = UUID("10000000-0000-0000-0000-000000000002")
    client_id: UUID = UUID("00000000-0000-0000-0000-000000000031")

    async def get_menu(self, identity, *, request_id: str):  # noqa: ANN001
        self.request_ids.append(request_id)
        return MenuResponse(
            user=BotUserContext(
                crm_user_id="00000000-0000-0000-0000-000000000001",
                display_name="Иван",
                role="Coach",
            ),
            attendanceDateWindow=AttendanceDateWindow(
                today=date(2026, 5, 13),
                minTrainingDate=date(2026, 5, 11),
                maxTrainingDate=date(2026, 5, 13),
            ),
            items=[MenuItem(code="attendance", title="Посещения")],
        )

    async def list_attendance_lessons(  # noqa: ANN001
        self,
        identity,
        *,
        training_date: date,
        request_id: str,
    ) -> AttendanceLessonsResponse:
        self.request_ids.append(request_id)
        return AttendanceLessonsResponse(
            items=[
                AttendanceLesson(
                    lessonOccurrenceId=self.morning_lesson_id,
                    lessonDate=training_date,
                    groupId=self.group_id,
                    groupName="Группа",
                    startTime="10:00",
                    durationMinutes=60,
                    hallName="Зал 1",
                    branchName="Центр",
                    effectiveTrainers=["Утренний тренер"],
                    status="Scheduled",
                    canViewAttendance=True,
                    canEditAttendance=True,
                ),
                AttendanceLesson(
                    lessonOccurrenceId=self.evening_lesson_id,
                    lessonDate=training_date,
                    groupId=self.group_id,
                    groupName="Группа",
                    startTime="18:30",
                    durationMinutes=75,
                    hallName="Зал 2",
                    branchName="Центр",
                    effectiveTrainers=[
                        {
                            "fullName": "Вечерний тренер",
                            "kind": "Substitute",
                            "substitutionId": "20000000-0000-0000-0000-000000000001",
                        }
                    ],
                    status="Scheduled",
                    canViewAttendance=True,
                    canEditAttendance=True,
                ),
            ]
        )

    async def get_attendance_lesson_roster(  # noqa: ANN001
        self,
        identity,
        *,
        lesson_occurrence_id: UUID,
        lesson_date: date,
        request_id: str,
    ) -> AttendanceRosterResponse:
        self.request_ids.append(request_id)
        self.roster_requests.append((lesson_occurrence_id, lesson_date))
        return AttendanceRosterResponse(
            groupId=self.group_id,
            groupName="Группа",
            trainingDate=lesson_date,
            attendanceDateWindow={
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            clients=[
                {
                    "id": str(self.client_id),
                    "fullName": "Петр Иванов",
                    "isPresent": False,
                    "membershipWarning": None,
                }
            ],
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
        self.request_ids.append(request_id)
        self.save_requests.append((lesson_occurrence_id, lesson_date))
        self.save_idempotency_keys.append(idempotency_key)
        return AttendanceSaveResponse(
            groupName="Группа",
            trainingDate=lesson_date,
            attendanceDateWindow={
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            markedCount=len(marks),
            presentCount=0,
            absentCount=1,
            warnings=[],
        )

    async def list_attendance_groups(self, *args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("attendance flow must list concrete lessons")

    async def get_attendance_roster(self, *args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("attendance flow must request roster by lesson occurrence")

    async def save_attendance(self, *args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("attendance flow must save by lesson occurrence")


@pytest.fixture()
def settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    return Settings()


@pytest.fixture()
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_event_dispatch_table_routes_to_exact_scenario_handler(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(),
        session_factory=session_factory,
    )
    attendance_start = AsyncMock(return_value=BotResponse(text="attendance.start"))
    attendance_date = AsyncMock(return_value=BotResponse(text="attendance.date"))
    attendance_group = AsyncMock(return_value=BotResponse(text="attendance.group"))
    attendance_toggle = AsyncMock(return_value=BotResponse(text="attendance.toggle"))
    attendance_save = AsyncMock(return_value=BotResponse(text="attendance.save"))
    client_text = AsyncMock(return_value=BotResponse(text="clients.text"))
    client_start = AsyncMock(return_value=BotResponse(text="clients.start"))
    client_page = AsyncMock(return_value=BotResponse(text="clients.page"))
    client_card = AsyncMock(return_value=BotResponse(text="clients.card"))
    client_memberships = AsyncMock(return_value=BotResponse(text="clients.memberships"))
    service._attendance.start = attendance_start
    service._attendance.select_date = attendance_date
    service._attendance.select_group = attendance_group
    service._attendance.toggle_mark = attendance_toggle
    service._attendance.save = attendance_save
    service._clients.handle_text = client_text
    service._clients.start_search = client_start
    service._clients.paginate_search = client_page
    service._clients.show_card = client_card
    service._clients.show_memberships = client_memberships

    client_id = UUID("00000000-0000-0000-0000-000000000031")
    group_id = UUID("00000000-0000-0000-0000-000000000021")
    cases = [
        ("text", None, "query", client_text, (), {}, "clients.text"),
        ("callback", "menu|attendance", None, attendance_start, (), {}, "attendance.start"),
        (
            "callback",
            "adt|2026-05-13",
            None,
            attendance_date,
            ("2026-05-13",),
            {},
            "attendance.date",
        ),
        (
            "callback",
            f"agr|{group_id}",
            None,
            attendance_group,
            (str(group_id),),
            {},
            "attendance.group",
        ),
        (
            "callback",
            f"atg|{client_id}",
            None,
            attendance_toggle,
            (str(client_id),),
            {},
            "attendance.toggle",
        ),
        ("callback", "asv", None, attendance_save, (), {}, "attendance.save"),
        ("callback", "menu|client_search", None, client_start, (), {}, "clients.start"),
        ("callback", "srp|2", None, client_page, (2,), {}, "clients.page"),
        (
            "callback",
            f"ccd|{client_id}",
            None,
            client_card,
            (client_id,),
            {"replace_existing": True},
            "clients.card",
        ),
        (
            "callback",
            "menu|expiring_memberships",
            None,
            client_memberships,
            (),
            {"list_code": "expiring_memberships", "page": 1, "replace_existing": True},
            "clients.memberships",
        ),
        (
            "callback",
            "mlp|expiring_memberships|2",
            None,
            client_memberships,
            (),
            {"list_code": "expiring_memberships", "page": 2, "replace_existing": True},
            "clients.memberships",
        ),
    ]

    for update_id, (
        kind,
        callback_data,
        event_text,
        handler,
        args,
        kwargs,
        expected_text,
    ) in enumerate(
        cases,
        start=1000,
    ):
        event = NormalizedTelegramEvent(
            update_id=update_id,
            event_key=f"event:{update_id}",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind=kind,
            callback_data=callback_data,
            text=event_text,
        )

        response = await service.handle_event(event)

        assert response.text == expected_text
        handler.assert_awaited_once_with(event, *args, **kwargs)
        handler.reset_mock()


@pytest.mark.asyncio
async def test_unknown_and_expired_callbacks_return_exact_recovery_responses(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(),
        session_factory=session_factory,
    )

    unknown = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=1100,
            event_key="callback:1100",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="unknown|payload",
        )
    )
    expired_attendance = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=1101,
            event_key="callback:1101",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="agr|00000000-0000-0000-0000-000000000021",
        )
    )
    expired_search = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=1102,
            event_key="callback:1102",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="srp|2",
        )
    )

    assert unknown == BotResponse(text="Команда не поддерживается.", replace_existing=True)
    assert expired_attendance.text == "Выберите дату тренировки."
    assert expired_attendance.replace_existing is True
    assert expired_search == BotResponse(
        text="Введите ФИО или телефон клиента.",
        replace_existing=True,
    )


@pytest.mark.asyncio
async def test_unknown_user_id_command_returns_safe_message(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(known_user=False),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=1,
            event_key="message:1",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="command",
            command="id",
            text="/id",
        )
    )

    assert response.text == (
        "Ваш Telegram ID: 777. Передайте его администратору CRM для подключения бота."
    )


@pytest.mark.asyncio
async def test_start_for_known_user_returns_menu(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(known_user=True),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=2,
            event_key="message:2",
            chat_id=10,
            chat_type="private",
            platform_user_id="888",
            kind="command",
            command="start",
            text="/start",
        )
    )

    assert response.text == "Иван, выберите действие."
    assert response.reply_markup is not None
    assert response.reply_markup.inline_keyboard[0][0].callback_data == "menu|attendance"


@pytest.mark.asyncio
async def test_super_administrator_menu_renders_backend_actions_only(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(
            role="SuperAdministrator",
            menu_items=(
                MenuItem(code="client_search", title="Поиск клиента"),
                MenuItem(code="attendance", title="Посещения"),
            ),
        ),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=82,
            event_key="message:82",
            chat_id=10,
            chat_type="private",
            platform_user_id="888",
            kind="command",
            command="start",
            text="/start",
        )
    )

    assert response.text == "Иван, выберите действие."
    assert response.reply_markup is not None
    rendered_callbacks = [
        button.callback_data for row in response.reply_markup.inline_keyboard for button in row
    ]
    assert rendered_callbacks == ["menu|client_search", "menu|attendance"]


@pytest.mark.asyncio
async def test_administrator_attendance_dates_render_backend_business_window(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(
            role="Administrator",
            attendance_today=date(2031, 1, 9),
            attendance_min_training_date=None,
            attendance_max_training_date=date(2031, 1, 9),
        ),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=801,
            event_key="callback:801",
            chat_id=10,
            chat_type="private",
            platform_user_id="888",
            kind="callback",
            callback_data="menu|attendance",
        )
    )

    assert response.reply_markup is not None
    assert [
        button.callback_data for row in response.reply_markup.inline_keyboard for button in row
    ] == [
        "adt|2031-01-09",
        "adt|2031-01-08",
        "adt|2031-01-07",
        "adt|2031-01-02",
    ]


@pytest.mark.asyncio
async def test_coach_attendance_dates_stop_at_backend_minimum(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(
            role="Coach",
            attendance_today=date(2031, 1, 9),
            attendance_min_training_date=date(2031, 1, 7),
            attendance_max_training_date=date(2031, 1, 9),
        ),
        session_factory=session_factory,
    )

    response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=802,
            event_key="callback:802",
            chat_id=10,
            chat_type="private",
            platform_user_id="888",
            kind="callback",
            callback_data="menu|attendance",
        )
    )

    assert response.reply_markup is not None
    assert [
        button.callback_data for row in response.reply_markup.inline_keyboard for button in row
    ] == [
        "adt|2031-01-09",
        "adt|2031-01-08",
        "adt|2031-01-07",
    ]


@pytest.mark.asyncio
async def test_administrator_empty_attendance_scope_renders_backend_empty_result(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(
            role="Administrator",
            attendance_groups=(),
            attendance_min_training_date=None,
        ),
        session_factory=session_factory,
    )
    event = NormalizedTelegramEvent(
        update_id=803,
        event_key="callback:803",
        chat_id=10,
        chat_type="private",
        platform_user_id="888",
        kind="callback",
        callback_data="adt|2026-05-13",
    )
    await DialogStateStore(settings=settings, session_factory=session_factory).save(
        event,
        ATTENDANCE_SCENARIO,
        {"step": "select_date", "role": "Administrator"},
    )

    response = await service.handle_event(event)

    assert response.text == "Нет доступных групп для отметки посещаемости."
    assert response.reply_markup is None


@pytest.mark.asyncio
async def test_super_administrator_attendance_groups_render_backend_data(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(
            role="SuperAdministrator",
            attendance_groups=(
                AttendanceGroup(
                    id="00000000-0000-0000-0000-000000000021",
                    name="Филиал A",
                    trainingStartTime="10:00",
                    weekdays=[1],
                ),
                AttendanceGroup(
                    id="00000000-0000-0000-0000-000000000022",
                    name="Филиал B",
                    trainingStartTime="18:30",
                    weekdays=[5],
                ),
            ),
        ),
        session_factory=session_factory,
    )
    event = NormalizedTelegramEvent(
        update_id=83,
        event_key="callback:83",
        chat_id=10,
        chat_type="private",
        platform_user_id="888",
        kind="callback",
        callback_data="adt|2026-05-13",
    )
    await DialogStateStore(settings=settings, session_factory=session_factory).save(
        event,
        ATTENDANCE_SCENARIO,
        {"step": "select_date", "role": "SuperAdministrator"},
    )

    response = await service.handle_event(event)

    assert "Филиал A: старт 10:00 · Пн" in response.text
    assert "Филиал B: старт 18:30 · Пт" in response.text
    assert response.reply_markup is not None
    rendered_callbacks = [
        button.callback_data for row in response.reply_markup.inline_keyboard for button in row
    ]
    assert rendered_callbacks == [
        "agr|00000000-0000-0000-0000-000000000021",
        "agr|00000000-0000-0000-0000-000000000022",
    ]


def test_professional_client_card_renders_status_free_membership_contract() -> None:
    card = ClientCardResponse(
        id="00000000-0000-0000-0000-000000000010",
        fullName="Проф Клиент",
        isProfessional=True,
        professionalComment="Сборная",
        currentMemberships=[
            ClientCardMembership(
                id="00000000-0000-0000-0000-000000000098",
                saleId="00000000-0000-0000-0000-000000000097",
                behaviorKind="Professional",
                membershipCatalogItemId="00000000-0000-0000-0000-000000000099",
                membershipLabel="Профессиональный",
                purchaseDate="2026-05-01",
                paymentDate="2026-04-28",
                expirationDate=None,
                pricingMode="Catalog",
                grossAmount=0,
                catalogPrice=0,
                coverageKind="AllGroups",
                entitlementState="Active",
                targetGroups=[
                    {
                        "groupId": "00000000-0000-0000-0000-000000000021",
                        "groupName": "Сборная",
                        "branchId": "00000000-0000-0000-0000-000000000031",
                        "branchName": "Центр",
                        "position": 0,
                        "isActive": True,
                    }
                ],
            )
        ],
    )

    text = ClientFlow._render_client_card(card)

    assert "Профессионал: Сборная" in text
    assert "Абонемент: Профессиональный, покупка 01.05.2026, оплата 28.04.2026" in text
    assert "Доступ: все группы; отчётность: Сборная" in text
    assert "оплачен" not in text.lower()


def test_amount_only_client_card_renders_backend_membership_label_without_payment_state() -> None:
    card = ClientCardResponse(
        id="00000000-0000-0000-0000-000000000012",
        fullName="Клиент без варианта",
        currentMemberships=[
            ClientCardMembership(
                id="00000000-0000-0000-0000-000000000013",
                saleId="00000000-0000-0000-0000-000000000014",
                behaviorKind="Term",
                membershipCatalogItemId=None,
                membershipLabel="Без варианта каталога",
                purchaseDate="2026-07-22",
                paymentDate="2026-07-20",
                expirationDate="2026-08-21",
                pricingMode="AmountOnly",
                grossAmount=1750,
                catalogPrice=None,
                coverageKind="TargetGroups",
                entitlementState="Active",
                targetGroups=[
                    {
                        "groupId": "00000000-0000-0000-0000-000000000021",
                        "groupName": "Йога",
                        "branchId": "00000000-0000-0000-0000-000000000031",
                        "branchName": "Центр",
                        "position": 0,
                        "isActive": True,
                    }
                ],
            )
        ],
    )

    text = ClientFlow._render_client_card(card)

    assert "Абонемент: Без варианта каталога" in text
    assert "Группы абонемента: 1. Йога (отчётность)" in text
    assert "оплачен" not in text.lower()


def test_client_card_renders_legacy_target_missing_warning_from_backend() -> None:
    card = ClientCardResponse(
        id="00000000-0000-0000-0000-000000000015",
        fullName="Legacy Client",
        currentMemberships=[
            {
                "id": "00000000-0000-0000-0000-000000000016",
                "saleId": "00000000-0000-0000-0000-000000000017",
                "behaviorKind": "Term",
                "membershipCatalogItemId": None,
                "membershipLabel": "Legacy",
                "purchaseDate": "2026-07-22",
                "paymentDate": "2026-07-20",
                "expirationDate": "2026-08-21",
                "pricingMode": "AmountOnly",
                "grossAmount": 1750,
                "catalogPrice": None,
                "coverageKind": "TargetGroups",
                "entitlementState": "LegacyTargetMissing",
                "targetGroups": [],
            }
        ],
    )

    text = ClientFlow._render_client_card(card)

    assert "Абонемент: Legacy" in text
    assert "Предупреждение: абонемент без групп, требуется исправление" in text


def test_expiring_membership_list_keeps_same_client_memberships_distinct() -> None:
    response = MembershipListResponse(
        items=[
            {
                "id": "00000000-0000-0000-0000-000000000032",
                "membershipId": "00000000-0000-0000-0000-000000000041",
                "saleId": "00000000-0000-0000-0000-000000000051",
                "fullName": "Петр Второй",
                "membershipLabel": "Месячный",
                "membershipExpiresAt": "2026-06-01",
                "targetGroups": [
                    {
                        "groupId": "00000000-0000-0000-0000-000000000021",
                        "groupName": "Йога",
                        "branchId": "00000000-0000-0000-0000-000000000031",
                        "branchName": "Центр",
                        "position": 0,
                        "isActive": True,
                    }
                ],
            },
            {
                "id": "00000000-0000-0000-0000-000000000032",
                "membershipId": "00000000-0000-0000-0000-000000000042",
                "saleId": "00000000-0000-0000-0000-000000000052",
                "fullName": "Петр Второй",
                "membershipLabel": "Разовая",
                "membershipExpiresAt": "2026-06-01",
                "targetGroups": [
                    {
                        "groupId": "00000000-0000-0000-0000-000000000022",
                        "groupName": "Бокс",
                        "branchId": "00000000-0000-0000-0000-000000000031",
                        "branchName": "Центр",
                        "position": 0,
                        "isActive": True,
                    }
                ],
            },
        ],
        page=1,
        pageSize=5,
        hasNextPage=False,
    )

    text = ClientFlow._render_membership_list_text("Заканчивающиеся абонементы", response)

    assert response.items[0].membership_id != response.items[1].membership_id
    assert response.items[0].sale_id != response.items[1].sale_id
    assert "1. Петр Второй | Месячный | 01.06.2026 | 1. Йога (отчётность)" in text
    assert "2. Петр Второй | Разовая | 01.06.2026 | 1. Бокс (отчётность)" in text


def test_bot_service_no_longer_routes_removed_unpaid_payment_callbacks() -> None:
    assert "unpaid_memberships" not in MenuItem.model_fields["code"].annotation.__args__
    assert not hasattr(BotService, "_confirm_payment")
    assert not hasattr(BotService, "_mark_payment")
    assert not hasattr(keyboards, "render_payment_confirmation_keyboard")


def test_group_schedule_rendering_uses_backend_values_without_local_validation() -> None:
    group = AttendanceGroup(
        id="00000000-0000-0000-0000-000000000021",
        name="Группа",
        training_start_time="19:00",
        duration_minutes=75,
        weekdays=[5, 1, 8],
    )
    client_group = ClientGroupSummary(
        id="00000000-0000-0000-0000-000000000021",
        name="Группа",
        training_start_time="19:00",
        duration_minutes=75,
        weekdays=[5, 1, 8],
    )

    text = AttendanceFlow._render_groups_text(date(2026, 5, 13), [group])

    assert "Группа: старт 19:00 · Пт, Пн, 8 · 75 мин" in text
    assert format_client_group(client_group) == ("Группа (старт 19:00 · Пт, Пн, 8 · 75 мин)")


def test_attendance_lesson_rendering_uses_occurrence_details_and_replacement_marker() -> None:
    lesson = AttendanceLesson(
        lessonOccurrenceId="10000000-0000-0000-0000-000000000001",
        lessonDate="2026-05-13",
        groupId="00000000-0000-0000-0000-000000000021",
        groupName="Группа",
        startTime="19:00",
        durationMinutes=75,
        hallName="Зал 1",
        branchName="Центр",
        effectiveTrainers=[
            {
                "trainerId": "00000000-0000-0000-0000-000000000081",
                "fullName": "Иван Основной",
                "kind": "Primary",
            },
            {
                "trainerId": "00000000-0000-0000-0000-000000000082",
                "fullName": "Петр Замещающий",
                "kind": "Substitute",
                "replacedTrainerId": "00000000-0000-0000-0000-000000000081",
                "substitutionId": "20000000-0000-0000-0000-000000000001",
            },
        ],
        status="Cancelled",
        canViewAttendance=True,
        canEditAttendance=False,
    )

    text = AttendanceFlow._render_groups_text(date(2026, 5, 13), [lesson])

    assert "Группа: старт 19:00 · 75 мин · Зал 1 · Центр" in text
    assert "тренеры: Иван Основной, Петр Замещающий (замена)" in text
    assert "отменено" in text


@pytest.mark.asyncio
async def test_attendance_save_omits_warning_block_when_backend_returns_no_warnings(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeAttendanceCrmClient(
            AttendanceSaveResponse(
                groupName="Группа",
                trainingDate=date(2026, 5, 8),
                attendanceDateWindow=AttendanceDateWindow(
                    today=date(2026, 5, 13),
                    minTrainingDate=date(2026, 5, 11),
                    maxTrainingDate=date(2026, 5, 13),
                ),
                markedCount=1,
                presentCount=1,
                absentCount=0,
                warnings=[],
            )
        ),
        session_factory=session_factory,
    )
    event = NormalizedTelegramEvent(
        update_id=3,
        event_key="callback:3",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind="callback",
        callback_data="asv",
    )
    await DialogStateStore(settings=settings, session_factory=session_factory).save(
        event,
        ATTENDANCE_SCENARIO,
        {
            "step": "draft",
            "training_date": "2026-05-08",
            "lesson_occurrence_id": "10000000-0000-0000-0000-000000000001",
            "group_id": "00000000-0000-0000-0000-000000000021",
            "group_name": "Группа",
            "marks": [
                {
                    "client_id": "00000000-0000-0000-0000-000000000010",
                    "full_name": "Проф Клиент",
                    "is_present": True,
                    "warning": None,
                }
            ],
        },
    )

    response = await service.handle_event(event)

    assert "Посещения сохранены." in response.text
    assert "Предупреждения" not in response.text
    assert "Проф Клиент" not in response.text


@pytest.mark.asyncio
async def test_attendance_stale_draft_without_lesson_occurrence_restarts_without_legacy_write(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    service = BotService(
        settings=settings,
        crm_client=FakeCrmClient(),
        session_factory=session_factory,
    )
    event = NormalizedTelegramEvent(
        update_id=905,
        event_key="callback:905",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind="callback",
        callback_data="asv",
    )
    state_store = DialogStateStore(settings=settings, session_factory=session_factory)
    await state_store.save(
        event,
        ATTENDANCE_SCENARIO,
        {
            "step": "draft",
            "training_date": "2026-05-13",
            "group_id": "00000000-0000-0000-0000-000000000021",
            "group_name": "Группа",
            "marks": [],
        },
    )

    response = await service.handle_event(event)

    assert response.text == "Выберите дату тренировки."
    assert response.replace_existing is True
    restarted_state = await state_store.get(event, ATTENDANCE_SCENARIO)
    assert restarted_state is not None
    assert restarted_state["step"] == "select_date"
    assert "group_id" not in restarted_state


@pytest.mark.asyncio
async def test_attendance_same_group_same_day_uses_selected_lesson_occurrence_contract(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(
        ["attendance-menu", "attendance-lessons", "attendance-roster", "attendance-save"]
    )
    monkeypatch.setattr(
        "gym_crm_bot.core.attendance_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = SameGroupSameDayCrmClient()
    service = BotService(
        settings=settings,
        crm_client=crm_client,
        session_factory=session_factory,
    )
    state_store = DialogStateStore(settings=settings, session_factory=session_factory)

    await service.handle_event(
        NormalizedTelegramEvent(
            update_id=910,
            event_key="callback:910",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="menu|attendance",
        )
    )
    lesson_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=911,
            event_key="callback:911",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="adt|2026-05-13",
        )
    )

    assert "Группа: старт 10:00 · 60 мин · Зал 1 · Центр" in lesson_response.text
    assert "Группа: старт 18:30 · 75 мин · Зал 2 · Центр" in lesson_response.text
    assert "Вечерний тренер (замена)" in lesson_response.text
    assert lesson_response.reply_markup is not None
    assert [row[0].callback_data for row in lesson_response.reply_markup.inline_keyboard] == [
        "agr|10000000-0000-0000-0000-000000000001",
        "agr|10000000-0000-0000-0000-000000000002",
    ]

    roster_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=912,
            event_key="callback:912",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="agr|10000000-0000-0000-0000-000000000002",
        )
    )

    assert "Петр Иванов: Не был" in roster_response.text
    draft_state = await state_store.get(
        NormalizedTelegramEvent(
            update_id=912,
            event_key="callback:912",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="agr|10000000-0000-0000-0000-000000000002",
        ),
        ATTENDANCE_SCENARIO,
    )
    assert draft_state is not None
    assert draft_state["lesson_occurrence_id"] == "10000000-0000-0000-0000-000000000002"
    assert crm_client.roster_requests == [
        (UUID("10000000-0000-0000-0000-000000000002"), date(2026, 5, 13))
    ]

    save_event = NormalizedTelegramEvent(
        update_id=913,
        event_key="callback:913",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind="callback",
        callback_data="asv",
    )
    save_response = await service.handle_event(save_event)

    assert "Посещения сохранены." in save_response.text
    assert crm_client.save_requests == [
        (UUID("10000000-0000-0000-0000-000000000002"), date(2026, 5, 13))
    ]
    assert crm_client.save_idempotency_keys == [
        "tg:777:913:attendance:10000000-0000-0000-0000-000000000002"
    ]
    assert crm_client.request_ids == [
        "attendance-menu",
        "attendance-lessons",
        "attendance-roster",
        "attendance-save",
    ]


@pytest.mark.asyncio
async def test_attendance_transcript_saves_with_idempotency_and_cleans_state(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(
        ["attendance-menu", "attendance-groups", "attendance-roster", "attendance-save"]
    )
    monkeypatch.setattr(
        "gym_crm_bot.core.attendance_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = TranscriptCrmClient()
    service = BotService(
        settings=settings,
        crm_client=crm_client,
        session_factory=session_factory,
    )
    state_store = DialogStateStore(settings=settings, session_factory=session_factory)

    date_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=900,
            event_key="callback:900",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="menu|attendance",
        )
    )
    assert date_response.text == "Выберите дату тренировки."
    assert date_response.reply_markup is not None
    assert date_response.reply_markup.inline_keyboard[0][0].callback_data == "adt|2026-05-13"

    group_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=901,
            event_key="callback:901",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="adt|2026-05-13",
        )
    )
    assert "Группа: старт 19:00 · Ср" in group_response.text
    assert group_response.reply_markup is not None
    assert group_response.reply_markup.inline_keyboard[0][0].callback_data == (
        "agr|00000000-0000-0000-0000-000000000021"
    )

    roster_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=902,
            event_key="callback:902",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="agr|00000000-0000-0000-0000-000000000021",
        )
    )
    assert "Петр Иванов: Не был" in roster_response.text
    assert roster_response.reply_markup is not None
    assert [row[0].callback_data for row in roster_response.reply_markup.inline_keyboard] == [
        "atg|00000000-0000-0000-0000-000000000031",
        "asv",
        "menu|root",
    ]

    toggle_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=903,
            event_key="callback:903",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="atg|00000000-0000-0000-0000-000000000031",
        )
    )
    assert "Петр Иванов: Был" in toggle_response.text

    save_event = NormalizedTelegramEvent(
        update_id=904,
        event_key="callback:904",
        chat_id=10,
        chat_type="private",
        platform_user_id="777",
        kind="callback",
        callback_data="asv",
    )
    save_response = await service.handle_event(save_event)

    assert save_response.text == (
        "Посещения сохранены.\nГруппа: Группа\nДата: 13.05.2026\nОтмечено: 1\nБыли: 1\nНе были: 0"
    )
    assert crm_client.save_idempotency_keys == [
        "tg:777:904:attendance:00000000-0000-0000-0000-000000000021"
    ]
    assert await state_store.get(save_event, ATTENDANCE_SCENARIO) is None
    assert crm_client.request_ids == [
        "attendance-menu",
        "attendance-groups",
        "attendance-roster",
        "attendance-save",
    ]


@pytest.mark.asyncio
async def test_client_transcript_pages_card_and_memberships_through_service(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_ids = iter(
        [
            "client-search-page-1",
            "client-search-page-2",
            "client-card",
            "memberships-page-1",
            "memberships-page-2",
        ]
    )
    monkeypatch.setattr(
        "gym_crm_bot.core.client_flow.build_request_id",
        lambda: next(request_ids),
    )
    crm_client = TranscriptCrmClient()
    service = BotService(
        settings=settings,
        crm_client=crm_client,
        session_factory=session_factory,
    )

    start_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=910,
            event_key="callback:910",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="menu|client_search",
        )
    )
    assert start_response.text == "Введите ФИО или телефон клиента."

    search_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=911,
            event_key="message:911",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="text",
            text="Петр",
        )
    )
    assert (
        search_response.text == "Результаты поиска: Петр\nСтраница: 1\n\n1. Петр Иванов | Месячный"
    )
    assert search_response.reply_markup is not None
    assert [row[0].callback_data for row in search_response.reply_markup.inline_keyboard] == [
        "ccd|00000000-0000-0000-0000-000000000031",
        "srp|2",
        "menu|root",
    ]

    page_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=912,
            event_key="callback:912",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="srp|2",
        )
    )
    assert page_response.text == "Результаты поиска: Петр\nСтраница: 2\n\n1. Петр Второй"
    assert page_response.reply_markup is not None
    assert [row[0].callback_data for row in page_response.reply_markup.inline_keyboard] == [
        "ccd|00000000-0000-0000-0000-000000000032",
        "srp|1",
        "menu|root",
    ]

    card_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=913,
            event_key="callback:913",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="ccd|00000000-0000-0000-0000-000000000032",
        )
    )
    assert "Телефон: +79990000000" in card_response.text
    assert "Абонемент: Месячный, покупка 01.05.2026, оплата 01.05.2026" in card_response.text

    membership_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=914,
            event_key="callback:914",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="menu|expiring_memberships",
        )
    )
    assert (
        membership_response.text
        == "Заканчивающиеся абонементы\nСтраница: 1\n\n1. Петр Второй | Месячный | 01.06.2026"
    )
    assert membership_response.reply_markup is not None
    assert [row[0].callback_data for row in membership_response.reply_markup.inline_keyboard] == [
        "ccd|00000000-0000-0000-0000-000000000032",
        "mlp|expiring_memberships|2",
        "menu|root",
    ]

    membership_page_response = await service.handle_event(
        NormalizedTelegramEvent(
            update_id=915,
            event_key="callback:915",
            chat_id=10,
            chat_type="private",
            platform_user_id="777",
            kind="callback",
            callback_data="mlp|expiring_memberships|2",
        )
    )
    assert membership_page_response.text == (
        "Заканчивающиеся абонементы\nСтраница: 2\n\n1. Петр Второй | Месячный | 01.06.2026"
    )
    assert membership_page_response.reply_markup is not None
    assert [
        row[0].callback_data for row in membership_page_response.reply_markup.inline_keyboard
    ] == [
        "ccd|00000000-0000-0000-0000-000000000032",
        "mlp|expiring_memberships|1",
        "menu|root",
    ]
    assert crm_client.request_ids == [
        "client-search-page-1",
        "client-search-page-2",
        "client-card",
        "memberships-page-1",
        "memberships-page-2",
    ]
    assert crm_client.client_search_requests == [
        ("Петр", 1, 5, "client-search-page-1"),
        ("Петр", 2, 5, "client-search-page-2"),
    ]
    assert crm_client.membership_list_requests == [
        (1, 5, "memberships-page-1"),
        (2, 5, "memberships-page-2"),
    ]
