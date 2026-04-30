from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from gym_crm_bot.config import Settings
from gym_crm_bot.core.service import BotService
from gym_crm_bot.crm.client import CrmBotApiClient
from gym_crm_bot.storage import Base, create_engine, create_session_factory
from gym_crm_bot.telegram.factory import create_telegram_adapter

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class HealthState:
    live: bool = True
    ready: bool = False


class GymCrmBotApplication:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.health = HealthState()
        self.engine = create_engine(settings)
        self.session_factory = create_session_factory(self.engine)
        self.crm_client = CrmBotApiClient(
            base_url=settings.crm_base_url,
            service_token=settings.crm_service_token.get_secret_value(),
            timeout_seconds=settings.crm_timeout_seconds,
            read_retry_attempts=settings.crm_read_retry_attempts,
            read_retry_backoff_seconds=settings.crm_read_retry_backoff_seconds,
        )
        self.bot_service = BotService(
            settings=settings,
            crm_client=self.crm_client,
            session_factory=self.session_factory,
        )
        self.telegram = create_telegram_adapter(
            settings=settings,
            bot_service=self.bot_service,
            session_factory=self.session_factory,
        )
        self.web_app = self._create_web_app()

    async def start(self) -> None:
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        self.health.ready = True
        logger.info("Bot application is ready.")

    async def stop(self) -> None:
        self.health.ready = False
        await self.telegram.stop()
        await self.crm_client.aclose()
        await self.engine.dispose()

    async def run(self) -> None:
        import uvicorn

        await self.start()
        server = uvicorn.Server(
            uvicorn.Config(
                self.web_app,
                host=self.settings.http_host,
                port=self.settings.http_port,
                log_config=None,
            )
        )
        server_task = asyncio.create_task(server.serve())
        polling_task = asyncio.create_task(self.telegram.run())

        try:
            done, pending = await asyncio.wait(
                {server_task, polling_task},
                return_when=asyncio.FIRST_EXCEPTION,
            )
            for task in done:
                exc = task.exception()
                if exc is not None:
                    raise exc
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
        finally:
            if not server.should_exit:
                server.should_exit = True
            await self.stop()

    def _create_web_app(self) -> FastAPI:
        app = FastAPI(title=self.settings.app_name)

        @app.get("/health/live")
        async def health_live() -> dict[str, str]:
            return {"status": "ok"}

        @app.get("/health/ready")
        async def health_ready() -> Any:
            if self.health.ready:
                return {"status": "ready"}
            return JSONResponse(status_code=503, content={"status": "not_ready"})

        return app


def create_application(settings: Settings) -> GymCrmBotApplication:
    return GymCrmBotApplication(settings)
