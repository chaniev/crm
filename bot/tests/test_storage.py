from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gym_crm_bot.storage.models import Base
from gym_crm_bot.storage.repositories import ConversationStateRepository, ProcessedUpdateRepository


@pytest.fixture()
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_conversation_state_upsert_get_and_clear(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    expires_at = datetime.now(UTC) + timedelta(hours=1)

    async with session_factory() as session:
        repo = ConversationStateRepository(session)
        await repo.upsert(
            platform="Telegram",
            chat_id=10,
            platform_user_id="77",
            scenario="attendance",
            state_json={"step": "draft"},
            expires_at=expires_at,
        )
        await session.commit()

    async with session_factory() as session:
        repo = ConversationStateRepository(session)
        state = await repo.get(
            platform="Telegram",
            chat_id=10,
            platform_user_id="77",
            scenario="attendance",
            now=datetime.now(UTC),
        )
        assert state is not None
        assert state.state_json == {"step": "draft"}

        await repo.clear(
            platform="Telegram",
            chat_id=10,
            platform_user_id="77",
            scenario="attendance",
        )
        await session.commit()

    async with session_factory() as session:
        repo = ConversationStateRepository(session)
        state = await repo.get(
            platform="Telegram",
            chat_id=10,
            platform_user_id="77",
            scenario="attendance",
            now=datetime.now(UTC),
        )
        assert state is None


@pytest.mark.asyncio
async def test_processed_update_reserve_duplicate_and_mark_processed(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        repo = ProcessedUpdateRepository(session)
        reserved = await repo.reserve(platform="Telegram", update_id=501, event_key="message:1")
        assert reserved is True
        await session.commit()

    async with session_factory() as session:
        repo = ProcessedUpdateRepository(session)
        duplicate = await repo.reserve(platform="Telegram", update_id=501, event_key="message:1")
        assert duplicate is False

    processed_at = datetime.now(UTC)
    async with session_factory() as session:
        repo = ProcessedUpdateRepository(session)
        await repo.mark_processed(
            platform="Telegram",
            update_id=501,
            result={"status": "processed"},
            processed_at=processed_at,
        )
        await session.commit()

    async with session_factory() as session:
        repo = ProcessedUpdateRepository(session)
        await repo.release(platform="Telegram", update_id=501)
        await session.commit()

