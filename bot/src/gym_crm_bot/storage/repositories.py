from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from gym_crm_bot.storage.models import ConversationState, ProcessedUpdate


class ConversationStateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(
        self,
        *,
        platform: str,
        chat_id: int,
        platform_user_id: str,
        scenario: str,
        now: datetime | None = None,
    ) -> ConversationState | None:
        query = select(ConversationState).where(
            ConversationState.platform == platform,
            ConversationState.chat_id == chat_id,
            ConversationState.platform_user_id == platform_user_id,
            ConversationState.scenario == scenario,
        )
        state = await self._session.scalar(query)
        if state is None:
            return None
        expires_at = _normalize_datetime(state.expires_at)
        current_time = _normalize_datetime(now)
        if current_time is not None and expires_at is not None and expires_at <= current_time:
            await self._session.delete(state)
            await self._session.flush()
            return None
        return state

    async def upsert(
        self,
        *,
        platform: str,
        chat_id: int,
        platform_user_id: str,
        scenario: str,
        state_json: dict[str, Any],
        expires_at: datetime | None,
    ) -> ConversationState:
        state = await self.get(
            platform=platform,
            chat_id=chat_id,
            platform_user_id=platform_user_id,
            scenario=scenario,
        )
        if state is None:
            state = ConversationState(
                platform=platform,
                chat_id=chat_id,
                platform_user_id=platform_user_id,
                scenario=scenario,
                state_json=state_json,
                expires_at=expires_at,
            )
            self._session.add(state)
            await self._session.flush()
            return state

        state.state_json = state_json
        state.expires_at = expires_at
        await self._session.flush()
        return state

    async def clear(
        self,
        *,
        platform: str,
        chat_id: int,
        platform_user_id: str,
        scenario: str,
    ) -> None:
        await self._session.execute(
            delete(ConversationState).where(
                ConversationState.platform == platform,
                ConversationState.chat_id == chat_id,
                ConversationState.platform_user_id == platform_user_id,
                ConversationState.scenario == scenario,
            )
        )


class ProcessedUpdateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def reserve(
        self,
        *,
        platform: str,
        update_id: int,
        event_key: str,
    ) -> bool:
        record = ProcessedUpdate(
            platform=platform,
            update_id=update_id,
            event_key=event_key,
        )
        self._session.add(record)
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            return False
        return True

    async def mark_processed(
        self,
        *,
        platform: str,
        update_id: int,
        result: dict[str, Any] | None,
        processed_at: datetime,
    ) -> None:
        record = await self._session.scalar(
            select(ProcessedUpdate).where(
                ProcessedUpdate.platform == platform,
                ProcessedUpdate.update_id == update_id,
            )
        )
        if record is None:
            return
        record.result = result
        record.processed_at = processed_at
        await self._session.flush()

    async def release(
        self,
        *,
        platform: str,
        update_id: int,
    ) -> None:
        await self._session.execute(
            delete(ProcessedUpdate).where(
                ProcessedUpdate.platform == platform,
                ProcessedUpdate.update_id == update_id,
            )
        )


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
