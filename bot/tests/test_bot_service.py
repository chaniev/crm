from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.config import Settings
from gym_crm_bot.core.attendance_flow import AttendanceFlow
from gym_crm_bot.core.client_flow import ClientFlow, format_client_group
from gym_crm_bot.core.dialog_state import ATTENDANCE_SCENARIO, DialogStateStore
from gym_crm_bot.core.service import BotService
from gym_crm_bot.crm.errors import CrmUserNotConfiguredError
from gym_crm_bot.crm.models import (
    AttendanceDateWindow,
    AttendanceGroup,
    AttendanceGroupsResponse,
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


@dataclass
class TranscriptCrmClient:
    request_ids: list[str] = field(default_factory=list)
    save_idempotency_keys: list[str] = field(default_factory=list)
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
            currentMembership={
                "id": "00000000-0000-0000-0000-000000000099",
                "behaviorKind": "Term",
                "membershipCatalogItemId": "00000000-0000-0000-0000-000000000098",
                "membershipLabel": "Месячный",
                "purchaseDate": "2026-05-01",
                "paymentDate": "2026-05-01",
                "expirationDate": "2026-06-01",
                "pricingMode": "Catalog",
                "grossAmount": 2000,
                "catalogPrice": 2000,
            },
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
            hasNextPage=False,
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
        currentMembership=ClientCardMembership(
            id="00000000-0000-0000-0000-000000000098",
            behaviorKind="Professional",
            membershipCatalogItemId="00000000-0000-0000-0000-000000000099",
            membershipLabel="Профессиональный",
            purchaseDate="2026-05-01",
            paymentDate="2026-04-28",
            expirationDate=None,
            pricingMode="Catalog",
            grossAmount=0,
            catalogPrice=0,
        ),
    )

    text = ClientFlow._render_client_card(card)

    assert "Профессионал: Сборная" in text
    assert "Абонемент: Профессиональный, покупка 01.05.2026, оплата 28.04.2026" in text
    assert "оплачен" not in text.lower()


def test_amount_only_client_card_renders_backend_membership_label_without_payment_state() -> None:
    card = ClientCardResponse(
        id="00000000-0000-0000-0000-000000000012",
        fullName="Клиент без варианта",
        currentMembership=ClientCardMembership(
            id="00000000-0000-0000-0000-000000000013",
            behaviorKind="Term",
            membershipCatalogItemId=None,
            membershipLabel="Без варианта каталога",
            purchaseDate="2026-07-22",
            paymentDate="2026-07-20",
            expirationDate="2026-08-21",
            pricingMode="AmountOnly",
            grossAmount=1750,
            catalogPrice=None,
        ),
    )

    text = ClientFlow._render_client_card(card)

    assert "Абонемент: Без варианта каталога" in text
    assert "оплачен" not in text.lower()


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
async def test_attendance_transcript_saves_with_idempotency_and_cleans_state(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
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
    assert all(crm_client.request_ids)


@pytest.mark.asyncio
async def test_client_transcript_pages_card_and_memberships_through_service(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
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
    assert membership_response.reply_markup.inline_keyboard[0][0].callback_data == (
        "ccd|00000000-0000-0000-0000-000000000032"
    )
    assert len(crm_client.request_ids) == 4
