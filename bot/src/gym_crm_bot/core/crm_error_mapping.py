from __future__ import annotations

from gym_crm_bot.core.idempotency import build_mutation_idempotency_key, build_request_id
from gym_crm_bot.core.service_types import BotResponse
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.crm.errors import (
    CrmClientError,
    CrmForbiddenError,
    CrmIdempotencyConflictError,
    CrmMustChangePasswordError,
    CrmTemporaryError,
    CrmUserInactiveError,
    CrmUserNotConfiguredError,
    CrmValidationError,
)
from gym_crm_bot.resources import bot_1_service_access as bot_1_service_access_text
from gym_crm_bot.resources.messages import (
    FORBIDDEN_MESSAGE,
    INACTIVE_USER_MESSAGE,
    MUST_CHANGE_PASSWORD_MESSAGE,
    TEMPORARY_ERROR_MESSAGE,
    VALIDATION_ERROR_PREFIX,
    unknown_user_message,
)
from gym_crm_bot.telegram.normalization import NormalizedTelegramEvent


class CrmErrorMapper:
    def __init__(self, crm_client: CrmBotApiClient) -> None:
        self._crm_client = crm_client

    async def map(
        self,
        error: CrmClientError,
        event: NormalizedTelegramEvent,
        *,
        audit_reason: str | None = None,
    ) -> BotResponse:
        if audit_reason is not None and isinstance(error, CrmForbiddenError):
            try:
                await self._crm_client.audit_access_denied(
                    event.identity,
                    request_id=build_request_id(),
                    idempotency_key=build_mutation_idempotency_key(
                        action="audit_access_denied",
                        platform_user_id=event.platform_user_id,
                        update_id=event.update_id,
                        target=audit_reason,
                    ),
                    reason=audit_reason,
                )
            except CrmClientError:
                pass

        if isinstance(error, CrmUserNotConfiguredError):
            return BotResponse(text=unknown_user_message(event.platform_user_id))
        if isinstance(error, CrmUserInactiveError):
            return BotResponse(text=INACTIVE_USER_MESSAGE)
        if isinstance(error, CrmMustChangePasswordError):
            return BotResponse(text=MUST_CHANGE_PASSWORD_MESSAGE)
        if isinstance(error, CrmForbiddenError):
            return BotResponse(text=FORBIDDEN_MESSAGE, replace_existing=event.kind == "callback")
        if isinstance(error, CrmValidationError):
            return BotResponse(
                text=f"{VALIDATION_ERROR_PREFIX} {error}",
                replace_existing=event.kind == "callback",
            )
        if isinstance(error, CrmIdempotencyConflictError):
            return BotResponse(
                text=bot_1_service_access_text.CRM_ERROR_MAPPING_LINE_69_299BAAEC,
                replace_existing=event.kind == "callback",
            )
        if isinstance(error, CrmTemporaryError):
            return BotResponse(
                text=TEMPORARY_ERROR_MESSAGE,
                replace_existing=event.kind == "callback",
            )
        return BotResponse(text=str(error), replace_existing=event.kind == "callback")
