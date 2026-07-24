from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotService
from gym_crm_bot.crm.errors import CrmUserNotConfiguredError
from gym_crm_bot.crm.models import (
    AttendanceGroup,
    AttendanceGroupsResponse,
    AttendanceSaveResponse,
    BotUserContext,
    ClientCardMembership,
    ClientCardResponse,
    ClientGroupSummary,
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

    async def resolve_session(self, identity, *, request_id: str):  # noqa: ANN001
        if not self.known_user:
            raise CrmUserNotConfiguredError("not configured")
        return BotUserContext(
            crm_user_id="00000000-0000-0000-0000-000000000001",
            display_name="Иван",
            role=self.role,
        )

    async def get_menu(self, identity, *, request_id: str):  # noqa: ANN001
        return MenuResponse(items=list(self.menu_items))

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
        button.callback_data
        for row in response.reply_markup.inline_keyboard
        for button in row
    ]
    assert rendered_callbacks == ["menu|client_search", "menu|attendance"]


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
    await service._save_state(
        event,
        "attendance",
        {"step": "select_date", "role": "SuperAdministrator"},
    )

    response = await service._select_attendance_date(event, "2026-05-13")

    assert "Филиал A: старт 10:00 · Пн" in response.text
    assert "Филиал B: старт 18:30 · Пт" in response.text
    assert response.reply_markup is not None
    rendered_callbacks = [
        button.callback_data
        for row in response.reply_markup.inline_keyboard
        for button in row
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

    text = BotService._render_client_card(card)

    assert "Профессионал: Сборная" in text
    assert (
        "Абонемент: Профессиональный, покупка 01.05.2026, оплата 28.04.2026"
        in text
    )
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

    text = BotService._render_client_card(card)

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

    text = BotService._render_attendance_groups_text(date(2026, 5, 13), [group])

    assert "Группа: старт 19:00 · Пт, Пн, 8 · 75 мин" in text
    assert BotService._format_client_group(client_group) == (
        "Группа (старт 19:00 · Пт, Пн, 8 · 75 мин)"
    )


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
    await service._save_state(
        event,
        "attendance",
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

    response = await service._save_attendance(event)

    assert "Посещения сохранены." in response.text
    assert "Предупреждения" not in response.text
    assert "Проф Клиент" not in response.text
