from __future__ import annotations

from dataclasses import dataclass

from aiogram.types import InlineKeyboardMarkup

from gym_crm_bot.crm.models import ClientPhotoContent


@dataclass(slots=True)
class BotResponse:
    text: str
    reply_markup: InlineKeyboardMarkup | None = None
    replace_existing: bool = False
    photo: ClientPhotoContent | None = None
