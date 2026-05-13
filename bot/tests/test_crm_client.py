from __future__ import annotations

from datetime import date
from uuid import UUID

import httpx
import pytest
import respx

from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import AttendanceMarkRequest, TelegramIdentity


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_sets_headers_and_retries_safe_reads() -> None:
    route = respx.get("http://crm.local/internal/bot/menu").mock(
        side_effect=[
            httpx.Response(status_code=503, json={"title": "temporary"}),
            httpx.Response(
                status_code=200,
                json={"items": [{"code": "attendance", "title": "Посещения"}]},
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
    assert route.call_count == 2
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer service-token"
    assert request.headers["X-Request-Id"] == "req-1"
    assert "Idempotency-Key" not in request.headers
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_sends_idempotency_key_only_for_mutations() -> None:
    route = respx.post("http://crm.local/internal/bot/clients/00000000-0000-0000-0000-000000000001/membership/mark-payment").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "clientId": "00000000-0000-0000-0000-000000000001",
                "fullName": "Иван Петров",
                "membershipLabel": "Monthly",
                "status": "Paid",
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

    await client.mark_membership_payment(
        TelegramIdentity(platform_user_id="777"),
        client_id="00000000-0000-0000-0000-000000000001",
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
            reason="forbidden",
        )

    assert route.call_count == 1
    await http_client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_crm_client_parses_professional_fields_without_local_payment_logic() -> None:
    respx.get("http://crm.local/internal/bot/clients").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "items": [
                    {
                        "id": "00000000-0000-0000-0000-000000000010",
                        "fullName": "Проф Клиент",
                        "isProfessional": True,
                        "professionalComment": "Сборная",
                        "hasActivePaidMembership": True,
                        "hasUnpaidCurrentMembership": False,
                    },
                    {
                        "id": "00000000-0000-0000-0000-000000000011",
                        "fullName": "Обычный Клиент",
                        "hasUnpaidCurrentMembership": True,
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
                "hasActivePaidMembership": True,
                "hasUnpaidCurrentMembership": False,
                "currentMembership": {
                    "membershipType": "SingleVisit",
                    "purchaseDate": "2026-05-01",
                    "expirationDate": None,
                    "isPaid": False,
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
    assert search.items[0].professional_comment == "Сборная"
    assert search.items[1].is_paid is None
    assert card.is_professional is True
    assert card.professional_comment == "Сборная"
    assert card.current_membership is not None
    assert card.current_membership.is_paid is False
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
async def test_crm_client_consumes_attendance_warnings_from_backend_only() -> None:
    respx.post(
        "http://crm.local/internal/bot/attendance/groups/00000000-0000-0000-0000-000000000021"
    ).mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "groupName": "Группа",
                "trainingDate": "2026-05-08",
                "markedCount": 2,
                "presentCount": 2,
                "absentCount": 0,
                "warnings": [
                    {
                        "clientId": "00000000-0000-0000-0000-000000000011",
                        "fullName": "Обычный Клиент",
                        "membershipWarning": "Абонемент не оплачен.",
                        "hasUnpaidCurrentMembership": True,
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

    response = await client.save_attendance(
        TelegramIdentity(platform_user_id="777"),
        group_id=UUID("00000000-0000-0000-0000-000000000021"),
        training_date=date(2026, 5, 8),
        marks=[
            AttendanceMarkRequest(
                clientId=UUID("00000000-0000-0000-0000-000000000010"),
                isPresent=True,
            ),
            AttendanceMarkRequest(
                clientId=UUID("00000000-0000-0000-0000-000000000011"),
                isPresent=True,
            ),
        ],
        request_id="req-prof-attendance",
        idempotency_key="idem-prof-attendance",
    )

    assert [warning.full_name for warning in response.warnings] == ["Обычный Клиент"]
    assert "Проф Клиент" not in "\n".join(str(warning) for warning in response.warnings)
    await http_client.aclose()
