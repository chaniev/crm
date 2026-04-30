from __future__ import annotations

import pytest

from gym_crm_bot.config import Settings
from gym_crm_bot.telegram.mtproto_adapter import TelegramMtProtoAdapter
from gym_crm_bot.telegram.mtproxy import MtProxyEndpoint, parse_mtproxy_url, parse_mtproxy_urls


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (
            "mtproxy://proxy.local:443/ddsecret",
            MtProxyEndpoint(host="proxy.local", port=443, secret="ddsecret"),
        ),
        (
            "mtproxy://proxy.local:443?secret=ddsecret",
            MtProxyEndpoint(host="proxy.local", port=443, secret="ddsecret"),
        ),
        (
            "tg://proxy?server=proxy.local&port=443&secret=ddsecret",
            MtProxyEndpoint(host="proxy.local", port=443, secret="ddsecret"),
        ),
        (
            "proxy.local:443:ddsecret",
            MtProxyEndpoint(host="proxy.local", port=443, secret="ddsecret"),
        ),
    ],
)
def test_parse_mtproxy_url(value: str, expected: MtProxyEndpoint) -> None:
    assert parse_mtproxy_url(value) == expected


def test_parse_mtproxy_urls_preserves_order() -> None:
    endpoints = parse_mtproxy_urls(
        (
            "mtproxy://one.local:443/secret-one",
            "mtproxy://two.local:443/secret-two",
        )
    )

    assert [endpoint.safe_name for endpoint in endpoints] == ["one.local:443", "two.local:443"]


@pytest.mark.parametrize(
    "value",
    [
        "",
        "mtproxy://proxy.local/secret",
        "mtproxy://proxy.local:443",
        "proxy.local:443",
        "proxy.local:not-a-port:secret",
        "tg://proxy?server=proxy.local&port=443",
    ],
)
def test_parse_mtproxy_url_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError):
        parse_mtproxy_url(value)


@pytest.mark.asyncio
async def test_mtproto_adapter_rotates_mtproxy_after_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    monkeypatch.setenv("BOT_CRM_BASE_URL", "http://crm.local")
    monkeypatch.setenv("BOT_CRM_SERVICE_TOKEN", "service-token")
    monkeypatch.setenv(
        "BOT_TELEGRAM_MTPROXY_URLS",
        "mtproxy://one.local:443/secret-one,mtproxy://two.local:443/secret-two",
    )
    monkeypatch.setenv("BOT_TELEGRAM_API_ID", "12345")
    monkeypatch.setenv("BOT_TELEGRAM_API_HASH", "api-hash")

    class FailingAdapter(TelegramMtProtoAdapter):
        seen: list[str]

        async def _run_with_endpoint(self, endpoint: MtProxyEndpoint) -> None:
            self.seen.append(endpoint.safe_name)
            if len(self.seen) == 2:
                self._stop_event.set()
            raise RuntimeError("connection failed")

        async def _wait_before_next_attempt(self) -> None:
            return

    adapter = FailingAdapter(
        settings=Settings(),
        bot_service=object(),  # type: ignore[arg-type]
        session_factory=object(),  # type: ignore[arg-type]
    )
    adapter.seen = []

    await adapter.run()

    assert adapter.seen == ["one.local:443", "two.local:443"]
