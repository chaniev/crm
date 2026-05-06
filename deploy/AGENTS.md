# Deploy Agent Rules

## Scope

Applies to all tasks inside `deploy/`.

Deploy owns local and production-oriented runtime composition for the CRM stack.

---

## Main areas

- `docker-compose.yml` -> service topology, dependencies, ports, health checks, volumes
- `.env.example` -> documented runtime configuration and defaults

---

## Deploy owns

- Docker Compose service wiring
- container startup order
- runtime environment variables
- exposed ports and internal network names
- named volumes
- healthcheck contracts
- local deployment documentation alignment

---

## Runtime rules

- Store secrets in env only
- Keep PostgreSQL internal unless explicitly required
- Keep backend as the source of CRM business rules
- Keep frontend as a proxy/UI consumer of backend APIs
- Keep bot as a thin adapter over backend internal Bot API
- Preserve health checks for services that other services depend on
- Do not change public ports or volume names without updating documentation and consumers

---

## Docker rules

Prefer:
- explicit service dependencies with health conditions
- stable internal service names
- named volumes for persisted state
- least necessary exposed ports
- env defaults that match `.env.example`

Avoid:
- duplicating business rules in runtime config
- hardcoding secrets
- hidden host dependencies
- publishing databases by default
- changing runtime contracts without validating affected services

---

## Required validation

Minimum:
- `docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml config --quiet`

If service wiring changes:
- validate affected service startup and health checks

If backend/frontend/bot runtime variables change:
- validate affected layer checks from the nearest `AGENTS.md`

## Preferred specialists

Default:
- docker-expert

Additional:
- dotnet-core-expert
- react-specialist
- python-pro
