from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from gym_crm_bot.crm.models import ClientListItem, MenuResponse
from gym_crm_bot.resources.callbacks import encode_callback


def render_menu_keyboard(menu: MenuResponse) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=item.title,
                callback_data=encode_callback("menu", item.code),
            )
        ]
        for item in menu.items
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_attendance_dates_keyboard(role: str, today: date) -> InlineKeyboardMarkup:
    dates = [today, today - timedelta(days=1)]
    if role == "Coach":
        dates.append(today - timedelta(days=2))
    else:
        dates.append(today - timedelta(days=2))
        dates.append(today - timedelta(days=7))

    rows = [
        [
            InlineKeyboardButton(
                text=value.strftime("%d.%m.%Y"),
                callback_data=encode_callback("adt", value.isoformat()),
            )
        ]
        for value in dates
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_attendance_groups_keyboard(groups: list[tuple[UUID, str]]) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=title, callback_data=encode_callback("agr", str(group_id)))]
        for group_id, title in groups
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_attendance_roster_keyboard(
    marks: list[tuple[UUID, str, bool]],
) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=("✅ " if is_present else "⬜ ") + title,
                callback_data=encode_callback("atg", str(client_id)),
            )
        ]
        for client_id, title, is_present in marks
    ]
    rows.append([InlineKeyboardButton(text="Сохранить", callback_data=encode_callback("asv"))])
    rows.append([InlineKeyboardButton(text="Меню", callback_data=encode_callback("menu", "root"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_search_results_keyboard(
    items: list[ClientListItem],
    *,
    page: int,
    has_next_page: bool,
) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=item.full_name,
                callback_data=encode_callback("ccd", str(item.id)),
            )
        ]
        for item in items
    ]

    pagination_row: list[InlineKeyboardButton] = []
    if page > 1:
        pagination_row.append(
            InlineKeyboardButton(text="Назад", callback_data=encode_callback("srp", str(page - 1)))
        )
    if has_next_page:
        pagination_row.append(
            InlineKeyboardButton(text="Дальше", callback_data=encode_callback("srp", str(page + 1)))
        )
    if pagination_row:
        rows.append(pagination_row)

    rows.append([InlineKeyboardButton(text="Меню", callback_data=encode_callback("menu", "root"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_membership_list_keyboard(
    items: list[ClientListItem],
    *,
    page: int,
    has_next_page: bool,
    allow_mark_payment: bool,
    list_code: str,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for item in items:
        rows.append(
            [
                InlineKeyboardButton(
                    text=item.full_name,
                    callback_data=encode_callback("ccd", str(item.id)),
                )
            ]
        )
        if allow_mark_payment:
            rows.append(
                [
                    InlineKeyboardButton(
                        text="Отметить оплату",
                        callback_data=encode_callback("mpc", str(item.id)),
                    )
                ]
            )

    pagination_row: list[InlineKeyboardButton] = []
    if page > 1:
        pagination_row.append(
            InlineKeyboardButton(
                text="Назад",
                callback_data=encode_callback("mlp", list_code, str(page - 1)),
            )
        )
    if has_next_page:
        pagination_row.append(
            InlineKeyboardButton(
                text="Дальше",
                callback_data=encode_callback("mlp", list_code, str(page + 1)),
            )
        )
    if pagination_row:
        rows.append(pagination_row)

    rows.append([InlineKeyboardButton(text="Меню", callback_data=encode_callback("menu", "root"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_payment_confirmation_keyboard(client_id: UUID) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Подтвердить оплату",
                    callback_data=encode_callback("mpy", str(client_id)),
                )
            ],
            [InlineKeyboardButton(text="Меню", callback_data=encode_callback("menu", "root"))],
        ]
    )
