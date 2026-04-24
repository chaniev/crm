from __future__ import annotations

UNKNOWN_USER_TEMPLATE = (
    "Ваш Telegram ID: {telegram_id}. Передайте его администратору CRM для подключения бота."
)
KNOWN_USER_ID_TEMPLATE = "Ваш Telegram ID: {telegram_id}. Бот подключен к вашей CRM-учетной записи."
PRIVATE_CHAT_ONLY_MESSAGE = "Бот работает только в личных чатах."
MUST_CHANGE_PASSWORD_MESSAGE = (
    "Доступ из бота временно закрыт. Сначала смените пароль в web-интерфейсе CRM."
)
INACTIVE_USER_MESSAGE = "Доступ к боту отключен. Обратитесь к администратору CRM."
FORBIDDEN_MESSAGE = "Это действие недоступно для вашей роли."
TEMPORARY_ERROR_MESSAGE = "CRM временно недоступна. Попробуйте еще раз позже."
VALIDATION_ERROR_PREFIX = "CRM отклонила запрос:"
EMPTY_GROUPS_MESSAGE = "Нет доступных групп для отметки посещаемости."
NO_ASSIGNED_GROUPS_MESSAGE = "Назначенные группы отсутствуют."
SEARCH_PROMPT_MESSAGE = "Введите ФИО или телефон клиента."
EMPTY_SEARCH_RESULTS_MESSAGE = "Клиенты не найдены."
EXPIRING_EMPTY_MESSAGE = "Заканчивающихся абонементов сейчас нет."
UNPAID_EMPTY_MESSAGE = "Неоплаченных абонементов сейчас нет."
PAYMENT_CONFIRM_MESSAGE = "Подтвердите отметку оплаты для клиента {full_name}."


def unknown_user_message(telegram_id: str) -> str:
    return UNKNOWN_USER_TEMPLATE.format(telegram_id=telegram_id)


def known_user_id_message(telegram_id: str) -> str:
    return KNOWN_USER_ID_TEMPLATE.format(telegram_id=telegram_id)
