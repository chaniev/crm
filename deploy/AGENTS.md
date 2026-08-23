# Deploy Agent Rules

## Scope

Applies to all tasks inside `deploy/` together with the root `AGENTS.md`.
Deploy owns local and server-oriented runtime composition for the CRM stack.

---

## Main areas

- `docker-compose.yml` -> local/source-build service topology and runtime wiring
- `docker-compose.server.yml` -> image-only server runtime wiring
- `.env.example` -> tracked, non-secret runtime configuration contract
- `SERVER_INSTALL.md` -> server installation, validation, and recovery runbook
- `build-images.sh`, `export-images.sh`, `load-images.sh`, `lib/` -> image lifecycle tooling

---

## Deploy ownership

Deploy owns:

- Docker Compose service wiring and startup order
- runtime environment-variable mapping
- exposed ports, internal service names, and named volumes
- healthcheck and shutdown contracts
- local/server Compose parity
- image build/export/load scripts
- operational documentation alignment

---

## Runtime and secret rules

- Store secrets only in untracked runtime environment files or an approved
  secret store.
- Tracked examples contain inert placeholders only. Never commit working
  passwords, tokens, API credentials, cookies, private proxy access secrets, or
  MTProto session material.
- Keep PostgreSQL internal unless an explicit requirement approves publication.
- Keep backend as the source of CRM business rules.
- Keep frontend as a proxy/UI consumer of backend APIs.
- Keep bot as a thin adapter over backend internal Bot API.
- Preserve healthchecks for services that other services depend on.
- Do not change public ports, internal service names, or volume names without
  updating all consumers, migration/recovery instructions, and validation.

---

## Compose parity

`docker-compose.yml` and `docker-compose.server.yml` must remain equivalent in
runtime service wiring. Expected differences are limited to source build
configuration versus prebuilt image use unless a documented server-only
exception is required.

When changing a service, environment variable, dependency, healthcheck, volume,
port, or shutdown rule:

- update both Compose files in the same task;
- update `deploy/.env.example` and affected operational documentation;
- validate both configurations;
- document any intentional parity exception next to the configuration.

---

## Parallel worktree runtime

When a CRM stack is started from a task worktree:

- use a task-local uncommitted `.env`;
- use a unique `COMPOSE_PROJECT_NAME`;
- use unique published `BACKEND_PORT` and `FRONTEND_PORT` values;
- rely on the task-specific Compose project to isolate networks, containers,
  and named volumes;
- set `BOT_ENABLED=false` unless bot runtime validation is required;
- never run multiple long-polling bot instances with the same Telegram token;
- resolve the exact Compose project before `down`, `down -v`, or cleanup;
- never stop or remove resources owned by another task workspace.

Use `.agents/skills/task-worktree/SKILL.md` for worktree and local runtime
isolation rules.

---

## Docker rules

Prefer:

- explicit dependencies with health conditions
- stable internal service names
- named volumes for persisted state
- least necessary published ports
- env defaults aligned with `.env.example`
- explicit signal handling and sufficient shutdown grace periods

Avoid:

- business rules in runtime configuration
- hardcoded credentials or functional secrets in tracked files
- hidden host dependencies
- publishing databases by default
- floating runtime differences between local and server Compose files
- cleanup commands whose Compose project or volume ownership is unresolved

---

## Required validation

Run from the repository root.

Minimum:

- `docker compose --project-directory . --env-file deploy/.env.example -f deploy/docker-compose.yml config --quiet`
- `docker compose --project-directory . --env-file deploy/.env.example -f deploy/docker-compose.server.yml config --quiet`
- `bash -n deploy/build-images.sh deploy/export-images.sh deploy/load-images.sh deploy/lib/images.sh`

If service wiring changes, validate affected startup, readiness, shutdown, one
representative dependency failure, and the documented recovery path.

If backend, frontend, or bot runtime variables change, also run the affected
layer checks from the nearest `AGENTS.md`.

---

## Code review rules

Flag:

- credentials or functional secrets in tracked examples or command output
- PostgreSQL or another private service published without an explicit requirement
- drift between local and server Compose runtime wiring
- dependency ordering without a meaningful health contract
- destructive cleanup with unresolved project, container, or volume ownership
- runtime variable changes missing service binding, example, consumer, or docs updates
- deploy scripts that lose image provenance, rollback, or platform clarity

Prefer the smallest operable fix with a clear validation and rollback path.

---

## Preferred specialists

Default:

- docker-expert

Additional:

- dotnet-backend-specialist
- react-specialist
- python-pro
