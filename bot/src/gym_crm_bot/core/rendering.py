from __future__ import annotations

from gym_crm_bot.crm.models import ClientGroupSummary


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
        parts.append(f"старт {training_start_time}")
    if weekdays:
        parts.append(", ".join(format_weekday(weekday) for weekday in weekdays))
    if duration_minutes is not None:
        parts.append(f"{duration_minutes} мин")
    return " · ".join(parts)


def format_weekday(weekday: int) -> str:
    labels = {
        1: "Пн",
        2: "Вт",
        3: "Ср",
        4: "Чт",
        5: "Пт",
        6: "Сб",
        7: "Вс",
    }
    return labels.get(weekday, str(weekday))
