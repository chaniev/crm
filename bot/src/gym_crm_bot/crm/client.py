from __future__ import annotations

import asyncio
import json
from datetime import date
from typing import Any, TypeVar
from uuid import UUID

import httpx
from pydantic import BaseModel

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
from gym_crm_bot.crm.models import (
    AttendanceGroupsResponse,
    AttendanceMarkRequest,
    AttendanceRosterResponse,
    AttendanceSaveResponse,
    BotUserContext,
    ClientCardResponse,
    ClientSearchResponse,
    MembershipListResponse,
    MembershipPaymentResult,
    MenuResponse,
    TelegramIdentity,
)

ModelT = TypeVar("ModelT", bound=BaseModel)


class CrmBotApiClient:
    def __init__(
        self,
        *,
        base_url: str,
        service_token: str,
        timeout_seconds: float,
        read_retry_attempts: int = 2,
        read_retry_backoff_seconds: float = 0.25,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._service_token = service_token
        self._read_retry_attempts = max(read_retry_attempts, 1)
        self._read_retry_backoff_seconds = max(read_retry_backoff_seconds, 0.0)
        self._owns_client = http_client is None
        self._http = http_client or httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout_seconds,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._http.aclose()

    async def resolve_session(
        self,
        identity: TelegramIdentity,
        *,
        request_id: str,
    ) -> BotUserContext:
        payload = await self._request_json(
            "POST",
            "/internal/bot/telegram/session/resolve",
            request_id=request_id,
            json_body=identity.as_payload(),
            safe_read=True,
        )
        return BotUserContext.model_validate(payload.get("user", payload))

    async def get_menu(
        self,
        identity: TelegramIdentity,
        *,
        request_id: str,
    ) -> MenuResponse:
        return await self._request_model(
            "GET",
            "/internal/bot/menu",
            MenuResponse,
            request_id=request_id,
            params=identity.as_query_params(),
            safe_read=True,
        )

    async def list_attendance_groups(
        self,
        identity: TelegramIdentity,
        *,
        request_id: str,
    ) -> AttendanceGroupsResponse:
        payload = await self._request_json(
            "GET",
            "/internal/bot/attendance/groups",
            request_id=request_id,
            params=identity.as_query_params(),
            safe_read=True,
        )
        return AttendanceGroupsResponse(
            items=payload if isinstance(payload, list) else payload.get("items", []),
        )

    async def get_attendance_roster(
        self,
        identity: TelegramIdentity,
        *,
        group_id: UUID,
        training_date: date,
        request_id: str,
    ) -> AttendanceRosterResponse:
        return await self._request_model(
            "GET",
            f"/internal/bot/attendance/groups/{group_id}/clients",
            AttendanceRosterResponse,
            request_id=request_id,
            params={
                **identity.as_query_params(),
                "trainingDate": training_date.isoformat(),
            },
            safe_read=True,
        )

    async def save_attendance(
        self,
        identity: TelegramIdentity,
        *,
        group_id: UUID,
        training_date: date,
        marks: list[AttendanceMarkRequest],
        request_id: str,
        idempotency_key: str,
    ) -> AttendanceSaveResponse:
        return await self._request_model(
            "POST",
            f"/internal/bot/attendance/groups/{group_id}",
            AttendanceSaveResponse,
            request_id=request_id,
            idempotency_key=idempotency_key,
            json_body={
                **identity.as_payload(),
                "trainingDate": training_date.isoformat(),
                "attendanceMarks": [mark.model_dump(by_alias=True) for mark in marks],
            },
        )

    async def search_clients(
        self,
        identity: TelegramIdentity,
        *,
        query: str,
        page: int,
        page_size: int,
        request_id: str,
    ) -> ClientSearchResponse:
        return await self._request_model(
            "GET",
            "/internal/bot/clients",
            ClientSearchResponse,
            request_id=request_id,
            params={
                **identity.as_query_params(),
                "q": query,
                "skip": str(max(page - 1, 0) * page_size),
                "take": str(page_size),
            },
            safe_read=True,
        )

    async def get_client_card(
        self,
        identity: TelegramIdentity,
        *,
        client_id: UUID,
        request_id: str,
    ) -> ClientCardResponse:
        return await self._request_model(
            "GET",
            f"/internal/bot/clients/{client_id}",
            ClientCardResponse,
            request_id=request_id,
            params=identity.as_query_params(),
            safe_read=True,
        )

    async def list_expiring_memberships(
        self,
        identity: TelegramIdentity,
        *,
        page: int,
        page_size: int,
        request_id: str,
    ) -> MembershipListResponse:
        payload = await self._request_json(
            "GET",
            "/internal/bot/clients/expiring-memberships",
            request_id=request_id,
            params={
                **identity.as_query_params(),
            },
            safe_read=True,
        )
        items = payload if isinstance(payload, list) else payload.get("items", [])
        return MembershipListResponse(
            items=items,
            page=page,
            pageSize=page_size,
            hasNextPage=False,
        )

    async def list_unpaid_memberships(
        self,
        identity: TelegramIdentity,
        *,
        page: int,
        page_size: int,
        request_id: str,
    ) -> MembershipListResponse:
        payload = await self._request_json(
            "GET",
            "/internal/bot/clients/unpaid-memberships",
            request_id=request_id,
            params={
                **identity.as_query_params(),
            },
            safe_read=True,
        )
        items = payload if isinstance(payload, list) else payload.get("items", [])
        return MembershipListResponse(
            items=items,
            page=page,
            pageSize=page_size,
            hasNextPage=False,
        )

    async def mark_membership_payment(
        self,
        identity: TelegramIdentity,
        *,
        client_id: UUID,
        request_id: str,
        idempotency_key: str,
    ) -> MembershipPaymentResult:
        return await self._request_model(
            "POST",
            f"/internal/bot/clients/{client_id}/membership/mark-payment",
            MembershipPaymentResult,
            request_id=request_id,
            idempotency_key=idempotency_key,
            json_body=identity.as_payload(),
        )

    async def audit_access_denied(
        self,
        identity: TelegramIdentity,
        *,
        request_id: str,
        reason: str,
    ) -> None:
        await self._request_json(
            "POST",
            "/internal/bot/audit/access-denied",
            request_id=request_id,
            json_body={
                **identity.as_payload(),
                "actionCode": reason,
                "reason": reason,
            },
        )

    async def _request_model(
        self,
        method: str,
        path: str,
        model: type[ModelT],
        *,
        request_id: str,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
        safe_read: bool = False,
    ) -> ModelT:
        payload = await self._request_json(
            method,
            path,
            request_id=request_id,
            params=params,
            json_body=json_body,
            idempotency_key=idempotency_key,
            safe_read=safe_read,
        )
        return model.model_validate(payload)

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        request_id: str,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
        safe_read: bool = False,
    ) -> Any:
        attempts = self._read_retry_attempts if safe_read else 1
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                response = await self._http.request(
                    method,
                    path,
                    params=params,
                    json=json_body,
                    headers=self._build_headers(
                        request_id=request_id,
                        idempotency_key=idempotency_key,
                    ),
                )
                if response.status_code >= 500:
                    error = self._build_error(response)
                    if safe_read and attempt < attempts:
                        last_error = error
                        await asyncio.sleep(self._read_retry_backoff_seconds * attempt)
                        continue
                    raise error

                if response.is_error:
                    raise self._build_error(response)

                if not response.content:
                    return {}
                return response.json()
            except httpx.RequestError as exc:
                temporary = CrmTemporaryError(str(exc))
                if safe_read and attempt < attempts:
                    last_error = temporary
                    await asyncio.sleep(self._read_retry_backoff_seconds * attempt)
                    continue
                raise temporary from exc

        if last_error is not None:
            raise last_error

        raise CrmTemporaryError("CRM request failed without a captured error.")

    def _build_headers(
        self,
        *,
        request_id: str,
        idempotency_key: str | None,
    ) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._service_token}",
            "X-Request-Id": request_id,
        }
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    def _build_error(self, response: httpx.Response) -> CrmClientError:
        payload: dict[str, Any] = {}
        detail = response.text

        if response.content:
            try:
                payload = response.json()
                detail = self._extract_detail(payload)
            except json.JSONDecodeError:
                payload = {}

        code = self._extract_code(payload)
        lowered_code = code.lower()

        if "not_configured" in lowered_code or "notconfigured" in lowered_code:
            return CrmUserNotConfiguredError(
                detail,
                status_code=response.status_code,
                payload=payload,
            )
        if "inactive" in lowered_code:
            return CrmUserInactiveError(detail, status_code=response.status_code, payload=payload)
        if "must_change_password" in lowered_code or "passwordchangerequired" in lowered_code:
            return CrmMustChangePasswordError(
                detail,
                status_code=response.status_code,
                payload=payload,
            )
        if "idempotency" in lowered_code:
            return CrmIdempotencyConflictError(
                detail,
                status_code=response.status_code,
                payload=payload,
            )

        if response.status_code in {400, 409, 422}:
            return CrmValidationError(detail, status_code=response.status_code, payload=payload)
        if response.status_code in {401, 403}:
            return CrmForbiddenError(detail, status_code=response.status_code, payload=payload)
        if response.status_code >= 500:
            return CrmTemporaryError(detail, status_code=response.status_code, payload=payload)
        return CrmClientError(detail, status_code=response.status_code, payload=payload)

    @staticmethod
    def _extract_code(payload: dict[str, Any]) -> str:
        for key in ("code", "errorCode", "type", "title"):
            value = payload.get(key)
            if isinstance(value, str):
                return value
        return ""

    @staticmethod
    def _extract_detail(payload: dict[str, Any]) -> str:
        for key in ("detail", "message", "title"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

        errors = payload.get("errors")
        if isinstance(errors, dict):
            flattened: list[str] = []
            for key, values in errors.items():
                if isinstance(values, list) and values:
                    flattened.append(f"{key}: {values[0]}")
            if flattened:
                return "; ".join(flattened)

        return "CRM request failed."
