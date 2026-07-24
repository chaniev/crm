from __future__ import annotations

import pytest
from pydantic import ValidationError

from gym_crm_bot.core.idempotency import build_mutation_idempotency_key
from gym_crm_bot.crm.models import ClientListItem, MenuItem, MenuResponse
from gym_crm_bot.resources.callbacks import decode_callback, encode_callback
from gym_crm_bot.resources.keyboards import render_membership_list_keyboard, render_menu_keyboard


def test_callback_roundtrip_and_length_guard() -> None:
    encoded = encode_callback("menu", "attendance")
    decoded = decode_callback(encoded)

    assert encoded == "menu|attendance"
    assert decoded.action == "menu"
    assert decoded.parts == ("attendance",)

    with pytest.raises(ValueError, match="too long"):
        encode_callback("x", "a" * 70)


def test_mutation_idempotency_key_is_stable() -> None:
    key = build_mutation_idempotency_key(
        action="attendance",
        platform_user_id="777",
        update_id=1001,
        target="group-1",
    )

    assert key == "tg:777:1001:attendance:group-1"


def test_render_menu_keyboard_contains_role_aware_actions() -> None:
    keyboard = render_menu_keyboard(
        MenuResponse(
            items=[
                MenuItem(code="attendance", title="Посещения"),
                MenuItem(code="client_search", title="Поиск клиента"),
            ]
        )
    )

    assert keyboard.inline_keyboard[0][0].text == "Посещения"
    assert keyboard.inline_keyboard[0][0].callback_data == "menu|attendance"
    assert keyboard.inline_keyboard[1][0].text == "Поиск клиента"
    assert keyboard.inline_keyboard[1][0].callback_data == "menu|client_search"


def test_menu_model_rejects_removed_unpaid_membership_action() -> None:
    with pytest.raises(ValidationError):
        MenuItem(code="unpaid_memberships", title="Неоплаченные")


def test_membership_list_keyboard_never_renders_removed_mark_payment_action() -> None:
    keyboard = render_membership_list_keyboard(
        [
            ClientListItem(
                id="00000000-0000-0000-0000-000000000010",
                fullName="Иван Петров",
                membershipLabel="Месячный",
                membershipExpiresAt="2026-05-10",
            )
        ],
        page=1,
        has_next_page=False,
        list_code="expiring_memberships",
    )

    callback_data = [
        button.callback_data
        for row in keyboard.inline_keyboard
        for button in row
    ]

    assert all(value is None or not value.startswith(("mpc", "mpy")) for value in callback_data)
