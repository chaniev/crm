from __future__ import annotations

from typing import Any


class CrmClientError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class CrmTemporaryError(CrmClientError):
    pass


class CrmValidationError(CrmClientError):
    pass


class CrmForbiddenError(CrmClientError):
    pass


class CrmUserNotConfiguredError(CrmClientError):
    pass


class CrmUserInactiveError(CrmClientError):
    pass


class CrmMustChangePasswordError(CrmClientError):
    pass


class CrmIdempotencyConflictError(CrmClientError):
    pass

