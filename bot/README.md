# Gym CRM Telegram bot

Thin Telegram adapter over the backend internal Bot API. The bot owns dialog
state, Telegram events and idempotency; CRM permissions, memberships,
attendance and validation remain backend-owned.

## Prerequisites and installation

- Python 3.13;
- [`uv`](https://docs.astral.sh/uv/);
- PostgreSQL for bot-owned runtime state;
- a running Gym CRM backend.

Install exactly the dependency versions recorded in `uv.lock`:

```bash
cd bot
uv sync --locked --extra dev
```

Do not use an unlocked `pip install` for development or production builds.

## Configuration

Settings are read from environment variables or a local uncommitted `.env`.
Start from [`deploy/.env.example`](../deploy/.env.example) and configure at
least:

- `BOT_DATABASE_URL`;
- `CRM_API_BASE_URL`;
- `CRM_BOT_API_TOKEN` matching backend `BOT_INTERNAL_API_TOKEN`;
- `BOT_TELEGRAM_TOKEN` when `BOT_ENABLED=true`;
- `BOT_MODE=LongPolling`.

Optional Telegram proxy and MTProto fallback variables are documented in the
shared env example. Never commit tokens, API hashes or session files.

## Run

```bash
cd bot
uv run --locked python -m gym_crm_bot.main
```

The local health server listens on `BOT_HTTP_HOST` and `BOT_HTTP_PORT` (`8080`
by default):

```bash
curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:8080/health/ready
```

The Compose service does not publish the bot port to the host. Check it inside
the container when running the full stack.

## Quality checks

```bash
cd bot
uv run --locked --extra dev ruff check .
uv run --locked --extra dev ruff format --check .
uv run --locked --extra dev mypy
uv run --locked --extra dev pytest
```

## Troubleshooting

- `BOT_TELEGRAM_TOKEN is required`: set the token or use `BOT_ENABLED=false`
  for runtime checks without Telegram polling.
- CRM requests return `401`/`403`: verify that `CRM_BOT_API_TOKEN` and backend
  `BOT_INTERNAL_API_TOKEN` are identical and that the CRM user is linked to the
  correct Telegram ID.
- Backend is unavailable: verify `CRM_API_BASE_URL` and backend readiness.
- Database connection fails: verify `BOT_DATABASE_URL` and PostgreSQL health.
- MTProxy mode fails at startup: configure both `BOT_TELEGRAM_API_ID` and
  `BOT_TELEGRAM_API_HASH`, or remove `BOT_TELEGRAM_MTPROXY_URLS`.
- Duplicate updates or unsafe write retries must not be fixed by retrying
  mutations; preserve request IDs and idempotency keys.

Detailed implementation constraints live in [`AGENTS.md`](AGENTS.md).
