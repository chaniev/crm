from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

import httpx
import pytest
import respx
from pydantic import ValidationError

from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import (
    AttendanceMarkRequest,
    AttendanceRosterResponse,
    AttendanceSaveResponse,
    BotUserContext,
    ClientCardMembership,
    MembershipListResponse,
    TelegramIdentity,
)


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_sets_headers_and_retries_safe_reads() -> None:
    route = respx.get("http://crm.local/internal/bot/menu").mock(
        side_effect=[
            httpx.Response(status_code=503, json={"title": "temporary"}),
            httpx.Response(
                status_code=200,
                json={
                    "user": {
                        "userId": "00000000-0000-0000-0000-000000000001",
                        "fullName": "Тренер",
                        "role": "Coach",
                    },
                    "attendanceDateWindow": {
                        "today": "2026-05-13",
                        "minTrainingDate": "2026-05-11",
                        "maxTrainingDate": "2026-05-13",
                    },
                    "items": [{"code": "attendance", "title": "Посещения"}],
                },
            ),
        ]
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        read_retry_attempts=2,
        read_retry_backoff_seconds=0,
        http_client=http_client,
    )

    response = await client.get_menu(
        TelegramIdentity(platform_user_id="777"),
        request_id="req-1",
    )

    assert response.items[0].code == "attendance"
    assert response.user.role == "Coach"
    assert response.attendance_date_window.today == date(2026, 5, 13)
    assert response.attendance_date_window.min_training_date == date(2026, 5, 11)
    assert response.attendance_date_window.max_training_date == date(2026, 5, 13)
    assert route.call_count == 2
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer service-token"
    assert request.headers["X-Request-Id"] == "req-1"
    assert "Idempotency-Key" not in request.headers
    await http_client.aclose()


def test_crm_client_does_not_expose_removed_payment_write_boundary() -> None:
    assert not hasattr(CrmBotApiClient, "list_unpaid_memberships")
    assert not hasattr(CrmBotApiClient, "mark_membership_payment")


def test_bot_user_context_accepts_super_administrator_role() -> None:
    context = BotUserContext.model_validate(
        {
            "userId": "00000000-0000-0000-0000-000000000082",
            "fullName": "Супер Администратор",
            "role": "SuperAdministrator",
        }
    )

    assert context.role == "SuperAdministrator"


def test_bot_user_context_rejects_unknown_role() -> None:
    with pytest.raises(ValidationError):
        BotUserContext.model_validate(
            {
                "userId": "00000000-0000-0000-0000-000000000083",
                "fullName": "Unknown Role",
                "role": "FinancialAdministrator",
            }
        )


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_sends_idempotency_key_for_remaining_attendance_write() -> None:
    route = respx.post("http://crm.local/internal/bot/attendance/groups/00000000-0000-0000-0000-000000000021").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "groupName": "Группа",
                "trainingDate": "2026-05-08",
                "attendanceDateWindow": {
                    "today": "2026-05-13",
                    "minTrainingDate": "2026-05-11",
                    "maxTrainingDate": "2026-05-13",
                },
                "markedCount": 1,
                "presentCount": 1,
                "absentCount": 0,
                "warnings": [],
            },
        )
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        http_client=http_client,
    )

    await client.save_attendance(
        TelegramIdentity(platform_user_id="777"),
        group_id=UUID("00000000-0000-0000-0000-000000000021"),
        training_date=date(2026, 5, 8),
        marks=[
            AttendanceMarkRequest(
                clientId=UUID("00000000-0000-0000-0000-000000000010"),
                isPresent=True,
            )
        ],
        request_id="req-2",
        idempotency_key="idem-1",
    )

    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer service-token"
    assert request.headers["X-Request-Id"] == "req-2"
    assert request.headers["Idempotency-Key"] == "idem-1"
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_does_not_retry_mutations() -> None:
    route = respx.post("http://crm.local/internal/bot/audit/access-denied").mock(
        return_value=httpx.Response(status_code=503, json={"title": "temporary"})
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        read_retry_attempts=3,
        read_retry_backoff_seconds=0,
        http_client=http_client,
    )

    with pytest.raises(CrmTemporaryError):
        await client.audit_access_denied(
            TelegramIdentity(platform_user_id="777"),
            request_id="req-3",
            idempotency_key="idem-audit-1",
            reason="forbidden",
        )

    assert route.call_count == 1
    request = route.calls.last.request
    assert request.headers["X-Request-Id"] == "req-3"
    assert request.headers["Idempotency-Key"] == "idem-audit-1"
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_parses_status_free_search_and_card_contracts() -> None:
    respx.get("http://crm.local/internal/bot/clients").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "items": [
                    {
                        "id": "00000000-0000-0000-0000-000000000010",
                        "fullName": "Проф Клиент",
                        "behaviorKind": "Professional",
                        "membershipLabel": "Профессиональный",
                        "isProfessional": True,
                        "professionalComment": "Сборная",
                        "hasActiveMembership": True,
                    },
                    {
                        "id": "00000000-0000-0000-0000-000000000011",
                        "fullName": "Обычный Клиент",
                        "hasActiveMembership": True,
                    },
                ],
                "skip": 0,
                "take": 5,
                "hasMore": False,
            },
        )
    )
    respx.get("http://crm.local/internal/bot/clients/00000000-0000-0000-0000-000000000010").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "id": "00000000-0000-0000-0000-000000000010",
                "fullName": "Проф Клиент",
                "isProfessional": True,
                "professionalComment": "Сборная",
                "hasActiveMembership": True,
                "currentMembership": {
                    "id": "00000000-0000-0000-0000-000000000098",
                    "behaviorKind": "Professional",
                    "membershipCatalogItemId": "00000000-0000-0000-0000-000000000099",
                    "membershipLabel": "Профессиональный",
                    "purchaseDate": "2026-05-01",
                    "paymentDate": "2026-04-28",
                    "expirationDate": None,
                    "pricingMode": "Catalog",
                    "grossAmount": 0,
                    "catalogPrice": 0,
                },
                "attendanceHistory": [],
            },
        )
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        http_client=http_client,
    )

    search = await client.search_clients(
        TelegramIdentity(platform_user_id="777"),
        query="Клиент",
        page=1,
        page_size=5,
        request_id="req-prof-search",
    )
    card = await client.get_client_card(
        TelegramIdentity(platform_user_id="777"),
        client_id="00000000-0000-0000-0000-000000000010",
        request_id="req-prof-card",
    )

    assert search.items[0].is_professional is True
    assert search.items[0].behavior_kind == "Professional"
    assert search.items[0].membership_label == "Профессиональный"
    assert search.items[0].professional_comment == "Сборная"
    assert card.is_professional is True
    assert card.professional_comment == "Сборная"
    assert card.current_membership is not None
    assert card.current_membership.id == UUID(
        "00000000-0000-0000-0000-000000000098"
    )
    assert card.current_membership.behavior_kind == "Professional"
    assert card.current_membership.type_label == "Профессиональный"
    assert card.current_membership.payment_date == date(2026, 4, 28)
    assert "is_paid" not in type(search.items[0]).model_fields
    assert "has_unpaid_current_membership" not in type(search.items[0]).model_fields
    assert "has_active_paid_membership" not in type(search.items[0]).model_fields
    assert "is_paid" not in type(card.current_membership).model_fields
    assert "has_unpaid_current_membership" not in type(card).model_fields
    assert "has_active_paid_membership" not in type(card).model_fields
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_parses_group_schedule_contract_from_backend() -> None:
    respx.get("http://crm.local/internal/bot/attendance/groups").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "items": [
                    {
                        "id": "00000000-0000-0000-0000-000000000021",
                        "name": "Группа",
                        "trainingStartTime": "19:00",
                        "durationMinutes": 75,
                        "weekdays": [5, 1],
                        "clientCount": 7,
                    }
                ],
            },
        )
    )
    respx.get("http://crm.local/internal/bot/clients/00000000-0000-0000-0000-000000000010").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "id": "00000000-0000-0000-0000-000000000010",
                "fullName": "Клиент",
                "groups": [
                    {
                        "id": "00000000-0000-0000-0000-000000000021",
                        "name": "Группа",
                        "trainingStartTime": "19:00",
                        "durationMinutes": 75,
                        "weekdays": [5, 1],
                    }
                ],
            },
        )
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        http_client=http_client,
    )

    groups = await client.list_attendance_groups(
        TelegramIdentity(platform_user_id="777"),
        request_id="req-schedule-groups",
    )
    card = await client.get_client_card(
        TelegramIdentity(platform_user_id="777"),
        client_id=UUID("00000000-0000-0000-0000-000000000010"),
        request_id="req-schedule-card",
    )

    assert groups.items[0].duration_minutes == 75
    assert groups.items[0].weekdays == [5, 1]
    assert card.groups[0].duration_minutes == 75
    assert card.groups[0].weekdays == [5, 1]
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_parses_amount_only_membership_sale_contract_from_backend() -> None:
    respx.get(
        "http://crm.local/internal/bot/clients/00000000-0000-0000-0000-000000000012"
    ).mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "id": "00000000-0000-0000-0000-000000000012",
                "fullName": "Клиент без варианта",
                "currentMembership": {
                    "id": "00000000-0000-0000-0000-000000000013",
                    "behaviorKind": "Term",
                    "membershipCatalogItemId": None,
                    "membershipLabel": "Без варианта каталога",
                    "purchaseDate": "2026-07-22",
                    "paymentDate": "2026-07-20",
                    "expirationDate": "2026-08-21",
                    "pricingMode": "AmountOnly",
                    "grossAmount": 1750,
                    "catalogPrice": None,
                },
                "attendanceHistory": [],
            },
        )
    )
    http_client = httpx.AsyncClient(base_url="http://crm.local")
    client = CrmBotApiClient(
        base_url="http://crm.local",
        service_token="service-token",
        timeout_seconds=5,
        http_client=http_client,
    )

    card = await client.get_client_card(
        TelegramIdentity(platform_user_id="777"),
        client_id=UUID("00000000-0000-0000-0000-000000000012"),
        request_id="req-amount-only-card",
    )

    assert card.current_membership is not None
    assert card.current_membership.behavior_kind == "Term"
    assert card.current_membership.membership_catalog_item_id is None
    assert card.current_membership.membership_label == "Без варианта каталога"
    assert card.current_membership.pricing_mode == "AmountOnly"
    assert card.current_membership.gross_amount == Decimal("1750")
    assert card.current_membership.catalog_price is None
    assert "payment_amount" not in type(card.current_membership).model_fields
    assert "is_paid" not in type(card.current_membership).model_fields
    await http_client.aclose()


def test_client_card_membership_does_not_accept_payment_amount_as_gross_amount() -> None:
    with pytest.raises(ValidationError, match="grossAmount"):
        ClientCardMembership.model_validate(
            {
                "id": "00000000-0000-0000-0000-000000000013",
                "behaviorKind": "Term",
                "membershipCatalogItemId": None,
                "membershipLabel": "Без варианта каталога",
                "purchaseDate": "2026-07-22",
                "paymentDate": "2026-07-20",
                "expirationDate": "2026-08-21",
                "pricingMode": "AmountOnly",
                "paymentAmount": 1750,
                "catalogPrice": None,
            }
        )


def test_crm_models_accept_status_free_attendance_and_expiring_contracts() -> None:
    roster = AttendanceRosterResponse.model_validate(
        {
            "groupId": "00000000-0000-0000-0000-000000000021",
            "groupName": "Группа",
            "trainingDate": "2026-05-08",
            "attendanceDateWindow": {
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            "clients": [
                {
                    "id": "00000000-0000-0000-0000-000000000011",
                    "fullName": "Обычный Клиент",
                    "isPresent": True,
                    "membershipWarning": None,
                }
            ],
        }
    )
    saved = AttendanceSaveResponse.model_validate(
        {
            "groupName": "Группа",
            "trainingDate": "2026-05-08",
            "attendanceDateWindow": {
                "today": "2026-05-13",
                "minTrainingDate": "2026-05-11",
                "maxTrainingDate": "2026-05-13",
            },
            "markedCount": 1,
            "presentCount": 1,
            "absentCount": 0,
            "warnings": [
                {
                    "clientId": "00000000-0000-0000-0000-000000000011",
                    "fullName": "Обычный Клиент",
                    "membershipWarning": "Истекает 10.05.2026",
                }
            ],
        }
    )
    expiring = MembershipListResponse.model_validate(
        {
            "items": [
                {
                    "id": "00000000-0000-0000-0000-000000000011",
                    "fullName": "Обычный Клиент",
                    "membershipLabel": "Месячный",
                    "membershipExpiresAt": "2026-05-10",
                }
            ],
            "page": 1,
            "pageSize": 5,
            "hasNextPage": False,
        }
    )

    assert roster.clients[0].warning is None
    assert saved.warnings[0].membership_warning == "Истекает 10.05.2026"
    assert expiring.items[0].membership_label == "Месячный"
    assert "has_unpaid_current_membership" not in type(roster.clients[0]).model_fields
    assert "has_unpaid_current_membership" not in type(saved.warnings[0]).model_fields
    assert "is_paid" not in type(expiring.items[0]).model_fields
    assert "has_unpaid_current_membership" not in type(expiring.items[0]).model_fields
