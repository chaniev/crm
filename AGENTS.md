# AGENTS.md

## Как работать с репозиторием

- Сначала читать этот файл.
- Если задача в `backend/`, сразу переходить в `backend/AGENTS.md`.
- Если задача в `frontend/`, сразу переходить в `frontend/AGENTS.md`.
- Если задача в `bot/`, сразу переходить в `bot/AGENTS.md`.
- Корневой `AGENTS.md` описывает только организацию работы по репозиторию и не хранит бизнес-правила проекта.

## Источники истины

Порядок приоритета:

1. запрос пользователя;
2. ближайший `AGENTS.md`;
3. исходники, типы, тесты и конфигурация;
4. `README.md`, `docker-compose.yml`, `package.json`, `.csproj`, `Program.cs`, `playwright.config.ts`;
5. `docs/` — только как дополнительный контекст.

CRM-бизнес-логика, правила ролей, доступа, абонементов, посещаемости и аудит-контрактов принадлежат backend. `frontend/` и `bot/` отображают backend-контракты и могут держать только UI/adapter-specific состояние, не дублируя CRM-правила как второй источник истины.

## Какие агенты используются

- `csharp-developer` — код на `C#`, прикладные сервисы, модели и persistence-слой.
- `dotnet-core-expert` — `ASP.NET Core`, endpoint'ы, auth, `CSRF`, middleware, конфигурация.
- `python-pro` — отдельный Python runtime-сервис `bot/`, Telegram adapter, async storage, pytest/ruff.
- `react-specialist` — экраны, формы, маршруты, состояние, доступность.
- `ui-designer` — implement-ready UI/UX перед заметной переработкой экрана.
- `ux-researcher` — синтез UI-фидбэка, наблюдений и проблем пользователей в конкретные продуктовые и implementation-ready рекомендации.
- `refactoring-specialist` — безопасный структурный рефакторинг без изменения поведения, снижение связности, дублирования и сложности.
- `test-automator` — backend tests, `Playwright`, regression coverage.
- `docker-expert` — `Dockerfile`, `docker-compose`, runtime, health checks, volumes.

## Проверки

- Изменился `backend/` — см. `backend/AGENTS.md`.
- Изменился `frontend/` — см. `frontend/AGENTS.md`.
- Изменился `bot/` — проверить `cd bot && ruff check .`, `cd bot && pytest`, `docker compose build bot`.
- Изменился контракт между слоями или runtime — проверить обе стороны.

Базовый набор:

- `dotnet test backend/GymCrm.slnx`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
