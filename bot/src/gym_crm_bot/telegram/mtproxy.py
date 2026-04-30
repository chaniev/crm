from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlparse


@dataclass(frozen=True, slots=True)
class MtProxyEndpoint:
    host: str
    port: int
    secret: str

    @property
    def safe_name(self) -> str:
        return f"{self.host}:{self.port}"

    @property
    def telethon_proxy(self) -> tuple[str, int, str]:
        return (self.host, self.port, self.secret)


def parse_mtproxy_url(value: str) -> MtProxyEndpoint:
    raw_value = value.strip()
    if not raw_value:
        msg = "MTProxy URL is empty."
        raise ValueError(msg)

    if raw_value.startswith("tg://proxy?") or raw_value.startswith("tg://socks?"):
        return _parse_tg_proxy_url(raw_value)
    if raw_value.startswith("mtproxy://"):
        return _parse_mtproxy_scheme_url(raw_value)
    return _parse_colon_separated_url(raw_value)


def parse_mtproxy_urls(values: tuple[str, ...]) -> tuple[MtProxyEndpoint, ...]:
    return tuple(parse_mtproxy_url(value) for value in values)


def _parse_tg_proxy_url(value: str) -> MtProxyEndpoint:
    parsed = urlparse(value)
    query = parse_qs(parsed.query)
    host = _required_query_value(query, "server", value)
    port = _parse_port(_required_query_value(query, "port", value), value)
    secret = _required_query_value(query, "secret", value)
    return MtProxyEndpoint(host=host, port=port, secret=secret)


def _parse_mtproxy_scheme_url(value: str) -> MtProxyEndpoint:
    parsed = urlparse(value)
    host = parsed.hostname
    port = parsed.port
    if not host or port is None:
        msg = f"MTProxy URL must include host and port: {value}"
        raise ValueError(msg)

    query = parse_qs(parsed.query)
    secret = _first_query_value(query, "secret")
    if secret is None:
        secret = parsed.path.lstrip("/")
    if not secret and parsed.username:
        secret = parsed.username
    if not secret:
        msg = f"MTProxy URL must include secret: {value}"
        raise ValueError(msg)

    return MtProxyEndpoint(host=host, port=port, secret=unquote(secret))


def _parse_colon_separated_url(value: str) -> MtProxyEndpoint:
    host, separator, rest = value.partition(":")
    if not separator:
        msg = f"MTProxy value must include host, port and secret: {value}"
        raise ValueError(msg)

    port_value, separator, secret = rest.partition(":")
    if not separator:
        msg = f"MTProxy value must include host, port and secret: {value}"
        raise ValueError(msg)

    return MtProxyEndpoint(host=host, port=_parse_port(port_value, value), secret=secret)


def _required_query_value(query: dict[str, list[str]], key: str, source: str) -> str:
    value = _first_query_value(query, key)
    if value is None:
        msg = f"MTProxy URL must include {key}: {source}"
        raise ValueError(msg)
    return value


def _first_query_value(query: dict[str, list[str]], key: str) -> str | None:
    values = query.get(key)
    if not values:
        return None
    value = values[0].strip()
    return value or None


def _parse_port(value: str, source: str) -> int:
    try:
        port = int(value)
    except ValueError as exc:
        msg = f"MTProxy port must be a number: {source}"
        raise ValueError(msg) from exc
    if port <= 0 or port > 65535:
        msg = f"MTProxy port is out of range: {source}"
        raise ValueError(msg)
    return port
