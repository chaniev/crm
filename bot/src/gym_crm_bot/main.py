from __future__ import annotations

import asyncio

from gym_crm_bot.app import create_application
from gym_crm_bot.config import get_settings
from gym_crm_bot.logging import configure_logging


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    application = create_application(settings)
    asyncio.run(application.run())


if __name__ == "__main__":
    main()
