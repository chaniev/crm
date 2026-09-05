from __future__ import annotations

from gym_crm_bot.crm.models import ClientGroupSummary
from gym_crm_bot.resources import bot_3_clients_rendering as bot_3_clients_rendering_text


def format_client_group(group: ClientGroupSummary) -> str:
    schedule = format_group_schedule(
        group.weekdays,
        group.duration_minutes,
        group.training_start_time,
    )
    return f"{group.name} ({schedule})" if schedule else group.name


def format_group_schedule(
    weekdays: list[int],
    duration_minutes: int | None,
    training_start_time: str | None,
) -> str:
    parts: list[str] = []
    if training_start_time:
        parts.append(bot_3_clients_rendering_text.RENDERING_LINE_22_040EE703(training_start_time))
    if weekdays:
        parts.append(", ".join(format_weekday(weekday) for weekday in weekdays))
    if duration_minutes is not None:
        parts.append(bot_3_clients_rendering_text.RENDERING_LINE_26_99B4C8F5(duration_minutes))
    return " · ".join(parts)


def format_weekday(weekday: int) -> str:
    labels = {
        1: bot_3_clients_rendering_text.RENDERING_LINE_32_31A8EE2F,
        2: bot_3_clients_rendering_text.RENDERING_LINE_33_839B2D5C,
        3: bot_3_clients_rendering_text.RENDERING_LINE_34_7EC16B9E,
        4: bot_3_clients_rendering_text.RENDERING_LINE_35_95661872,
        5: bot_3_clients_rendering_text.RENDERING_LINE_36_4CA114C2,
        6: bot_3_clients_rendering_text.RENDERING_LINE_37_95DAB017,
        7: bot_3_clients_rendering_text.RENDERING_LINE_38_7971972C,
    }
    return labels.get(weekday, str(weekday))
