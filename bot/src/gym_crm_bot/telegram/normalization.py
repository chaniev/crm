from __future__ import annotations

from dataclasses import dataclass

from gym_crm_bot.crm.models import TelegramIdentity


@dataclass(slots=True, frozen=True)
class NormalizedTelegramEvent:
    update_id: int
    event_key: str
    chat_id: int
    chat_type: str
    platform_user_id: str
    kind: str
    command: str | None = None
    text: str | None = None
    callback_data: str | None = None

    @property
    def identity(self) -> TelegramIdentity:
        return TelegramIdentity(platform_user_id=self.platform_user_id)


def normalize_update(update: object) -> NormalizedTelegramEvent | None:
    message = getattr(update, "message", None)
    if message is not None and getattr(message, "from_user", None) is not None:
        text = message.text or ""
        command = None
        kind = "text"
        if text.startswith("/"):
            kind = "command"
            command = text.split(maxsplit=1)[0][1:].split("@", 1)[0].lower()
        return NormalizedTelegramEvent(
            update_id=update.update_id,
            event_key=f"message:{message.message_id}",
            chat_id=message.chat.id,
            chat_type=message.chat.type,
            platform_user_id=str(message.from_user.id),
            kind=kind,
            command=command,
            text=text,
        )

    callback = getattr(update, "callback_query", None)
    if (
        callback is not None
        and getattr(callback, "from_user", None) is not None
        and callback.message is not None
    ):
        return NormalizedTelegramEvent(
            update_id=update.update_id,
            event_key=f"callback:{callback.id}",
            chat_id=callback.message.chat.id,
            chat_type=callback.message.chat.type,
            platform_user_id=str(callback.from_user.id),
            kind="callback",
            callback_data=callback.data or "",
        )

    return None
