from __future__ import annotations

_ATTENDANCE_FLOW_LINE_234_7E385447_TEMPLATE = (
    "Посещения сохранены.\nГруппа: {0}\nДата: {1}\nОтмечено: {2}\nБыли: {3}\nНе были: {4}"
)


def ATTENDANCE_FLOW_LINE_234_7E385447(
    value_0: object, value_1: object, value_2: object, value_3: object, value_4: object
) -> str:
    return _ATTENDANCE_FLOW_LINE_234_7E385447_TEMPLATE.format(
        value_0, value_1, value_2, value_3, value_4
    )


_ATTENDANCE_FLOW_LINE_242_89CE99C4_TEMPLATE = "\nПредупреждения:\n{0}"


def ATTENDANCE_FLOW_LINE_242_89CE99C4(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_242_89CE99C4_TEMPLATE.format(value_0)


_ATTENDANCE_FLOW_LINE_267_56B0987A_TEMPLATE = "Группа {0} на {1}: список пуст."


def ATTENDANCE_FLOW_LINE_267_56B0987A(value_0: object, value_1: object) -> str:
    return _ATTENDANCE_FLOW_LINE_267_56B0987A_TEMPLATE.format(value_0, value_1)


_ATTENDANCE_FLOW_LINE_268_A8949993_TEMPLATE = "Дата: {0}"


def ATTENDANCE_FLOW_LINE_268_A8949993(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_268_A8949993_TEMPLATE.format(value_0)


_ATTENDANCE_FLOW_LINE_268_AA9476A6_TEMPLATE = "Группа: {0}"


def ATTENDANCE_FLOW_LINE_268_AA9476A6(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_268_AA9476A6_TEMPLATE.format(value_0)


ATTENDANCE_FLOW_LINE_270_CD2E8AD3 = "Не был"

ATTENDANCE_FLOW_LINE_270_FF13DE89 = "Был"

_ATTENDANCE_FLOW_LINE_282_8951FBCA_TEMPLATE = "Дата: {0}. Выберите занятие."


def ATTENDANCE_FLOW_LINE_282_8951FBCA(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_282_8951FBCA_TEMPLATE.format(value_0)


_ATTENDANCE_FLOW_LINE_286_A3486BF2_TEMPLATE = "старт {0}"


def ATTENDANCE_FLOW_LINE_286_A3486BF2(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_286_A3486BF2_TEMPLATE.format(value_0)


_ATTENDANCE_FLOW_LINE_287_9B75002F_TEMPLATE = "{0} мин"


def ATTENDANCE_FLOW_LINE_287_9B75002F(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_287_9B75002F_TEMPLATE.format(value_0)


_ATTENDANCE_FLOW_LINE_295_12B8B72F_TEMPLATE = "тренеры: {0}"


def ATTENDANCE_FLOW_LINE_295_12B8B72F(value_0: object) -> str:
    return _ATTENDANCE_FLOW_LINE_295_12B8B72F_TEMPLATE.format(value_0)


ATTENDANCE_FLOW_LINE_297_8A097230 = "отменено"

ATTENDANCE_FLOW_LINE_63_62EAB7BE = "Выберите дату тренировки."
