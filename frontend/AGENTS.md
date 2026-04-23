# AGENTS.md

## Область

Этот файл обязателен для задач внутри `frontend/`.

## Структура

- `src/App.tsx` — session bootstrap, shell и верхнеуровневая маршрутизация.
- `src/lib/api.ts` — HTTP-запросы и типы контрактов с backend.
- `src/lib/appRoutes.ts` — маршруты и client-side redirect logic.
- `src/features/*` — route-level экраны по фичам.
- `src/features/shared/ux.tsx` — общие UX-компоненты.
- `src/theme.ts`, `src/App.css`, `src/index.css` — тема и общие стили.
- `e2e/*.spec.ts` — `Playwright`-регрессии.

## Какие агенты использовать

- `react-specialist` — основной агент для экранов, форм, маршрутов и состояния.
- `ui-designer` — перед заметной переработкой UI/UX.
- `test-automator` — `Playwright` и regression coverage.
- `dotnet-core-expert` или `csharp-developer` — если изменение упирается в backend-контракт.

## Короткие правила

- Не раздувать `src/App.tsx` бизнес-логикой.
- Новые API-контракты сначала оформлять в `src/lib/api.ts`.
- Новые route-сценарии сначала оформлять в `src/lib/appRoutes.ts`.
- Экраны держать в `src/features/*`, а не складывать все в общие файлы.
- Общие UI-паттерны выносить в `src/features/shared/ux.tsx`, если они переиспользуются.
- При новых правках и целевом рефакторинге двигаться к принципу `один файл — одна верхнеуровневая сущность`: компонент, hook, helper-module, `type`, `interface`, `enum` или константный словарь выносить в отдельный файл с понятным именем.
- Не добавлять новые крупные локальные типы, константы и helper-компоненты в route-level экраны; если участок уже меняется, извлекать их в соседние файлы фичи или в `src/features/shared/ux.tsx` при реальном переиспользовании.
- Сохранять стек `Mantine + Onest`.
- При изменении backend-контракта нужно синхронно обновлять `src/lib/api.ts` и экран-потребитель.

## Проверки

Минимум:

- `cd frontend && npm run lint`
- `cd frontend && npm run build`

Точечные e2e:

- `cd frontend && npm run test:e2e -- e2e/auth.spec.ts`
- `cd frontend && npm run test:e2e -- e2e/attendance.spec.ts`
- `cd frontend && npm run test:e2e -- e2e/responsive-main-screens.spec.ts`
- `cd frontend && npm run test:e2e -- e2e/stage12.spec.ts`
