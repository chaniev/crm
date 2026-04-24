from __future__ import annotations

import httpx
import pytest
import respx

from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import CrmTemporaryError
from gym_crm_bot.crm.models import TelegramIdentity


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
