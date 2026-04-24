from __future__ import annotations

from uuid import uuid4


def build_request_id() -> str:
    return str(uuid4())


def build_mutation_idempotency_key(
    *,
    action: str,
    platform_user_id: str,
    update_id: int,
    target: str,
) -> str:
    return f"tg:{platform_user_id}:{update_id}:{action}:{target}"

