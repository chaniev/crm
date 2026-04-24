from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote, unquote

MAX_CALLBACK_LENGTH = 64


@dataclass(frozen=True)
class CallbackPayload:
    action: str
    parts: tuple[str, ...]


def encode_callback(action: str, *parts: str) -> str:
    encoded_parts = [quote(part, safe=":-_") for part in parts]
    payload = "|".join([action, *encoded_parts])
    if len(payload) > MAX_CALLBACK_LENGTH:
        msg = f"Callback data is too long: {payload}"
        raise ValueError(msg)
    return payload


def decode_callback(data: str) -> CallbackPayload:
    if not data:
        msg = "Callback data is empty."
        raise ValueError(msg)
    parts = data.split("|")
    action = parts[0]
    decoded_parts = tuple(unquote(part) for part in parts[1:])
    return CallbackPayload(action=action, parts=decoded_parts)

