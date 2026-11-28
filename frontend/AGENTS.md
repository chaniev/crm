# Frontend Agent Rules

## Scope

Applies to all tasks inside `frontend/` together with the root `AGENTS.md`.
Frontend owns UX and typed consumption of backend contracts.

For TypeScript and React implementation and review, follow `frontend/CODE_STYLE.md`.

---

## Main areas

- `src/features/` -> screens and feature-oriented workflow components
- `src/features/shared/` -> reusable CRM UX/UI patterns
- `src/lib/api/**` -> typed backend API client, DTO mirrors, and error mapping
- `src/lib/api.ts` -> public API-client facade exports
- `src/lib/appRoutes.ts` -> routing and access-aware navigation
- `src/theme/` and `src/theme.ts` -> Mantine/Onest theme contracts
- `e2e/` -> Playwright workflow regression tests

---

## UX priorities

Optimize for fast, low-cognitive-load workflows for gym administrators and
coaches. Preserve clear primary actions, scanability, operational efficiency,
and narrow-screen usability.

---

## Процесс дизайна и реализации

Следовать `docs/DESIGN_PROCESS.md`. Для нового экрана или существенного
изменения сценария:

1. Изучить текущий интерфейс, `frontend/DESIGN.md` и возможности сервера.
2. Через `.agents/skills/crm-product-ux/SKILL.md` подготовить короткий бриф,
   путь пользователя, состав информации, каркасы и восстановление после ошибок.
3. Через `.agents/skills/crm-interface-design/SKILL.md` подготовить прототип
   на Mantine, Onest и общих компонентах CRM. При открытом выборе визуального
   направления подключить `.agents/skills/crm-visual-direction/SKILL.md`.
4. Проверить прототип: основную операцию, существенный сбой, применимое
   ограничение доступа, длинные данные и мобильное/настольное представление.
5. Зафиксировать выбор владельца на проверенном прототипе и описание состояний.
   Значимый выбор рабочего процесса согласовать раньше; однозначная локальная
   правка внутри принятых решений требует сравнения до/после без нового выбора.
6. После готовности плана реализовать согласованный контракт через
   `.agents/skills/crm-react-implementation/SKILL.md` с регрессионным покрытием
   в заданном планом порядке «сначала тесты».
7. Сравнить работающий интерфейс с прототипом и выполнить отдельный аудит
   затронутого сценария через `.agents/skills/crm-interface-audit/SKILL.md`.

Один прототип достаточен, когда решение следует из существующей системы.
Несколько вариантов нужны для конкретного открытого вопроса, а не для
формального количества. Готовый согласованный дизайн переиспользуется.
Для палитр сохранять одинаковую композицию и данные; выбранные изменения
вносить в общую тему вместе с `frontend/DESIGN.md`. Это не разрешает менять
смысл статусов, брендирование, бизнес-правила или стек реализации.

Мобильная матрица, безопасные отступы, малая высота, Safari, экранная клавиатура
и рабочие состояния определены только в
`.agents/skills/crm-interface-design/references/mobile-acceptance.md`.
Каждый видимый элемент поддерживает определённую операцию. Основные действия
остаются видимыми; горизонтальная прокрутка настольного содержимого не является
мобильной адаптацией по умолчанию.

Сохранять контекст возврата, идентификацию и безопасное восстановление.
При упрощении показывать конкретные решения по информации и сопоставимое
прохождение до/после. Различать дефекты, гипотезы улучшения и предпочтения.
Существенный конфликт с выбранным взаимодействием возвращает план в подготовку
по `docs/HARNESS.md`, а не разрешает молча изменить сценарий.

Минимальные артефакты — бриф, согласованный прототип с описанием состояний и
результаты проверки. Они могут быть частями одного документа задачи.
Предпочтительны `ux-researcher`, `ui-designer`, `react-specialist` и
`test-automator` в соответствующих ролях. Отдельные агенты не обязательны;
при самостоятельном выполнении сохраняются те же результаты и границы ревью.

## Выбор навыка по узкому запросу

- Сценарий и состав информации: `.agents/skills/crm-product-ux/SKILL.md`.
- Прототип, адаптивность, локальная визуальная правка или визуальная приёмка:
  `.agents/skills/crm-interface-design/SKILL.md`.
- Новый визуальный характер, палитра, концепции или запрос внешнему генератору:
  `.agents/skills/crm-visual-direction/SKILL.md`.
- React-код, состояние, эффекты, загрузка данных, композиция и производительность:
  `.agents/skills/crm-react-implementation/SKILL.md`.
- Самостоятельный аудит готового интерфейса или отдельный проход при приёмке:
  `.agents/skills/crm-interface-audit/SKILL.md`.

Применять только совместимые с React 19, TypeScript, Vite и Mantine рекомендации.
Сохранять API-клиент, маршруты, модель форм и тестовые подходы. Не добавлять
механизмы Next.js или параллельную дизайн-систему из внешних примеров.

---

## Contract rules

Frontend mirrors backend contracts without defining CRM semantics or inventing
permissions, validation, fields, states, or error meaning. Backend contract
changes update the affected `src/lib/api/**` module, public facade exports in
`src/lib/api.ts`, screens/components, and consumer tests.

---

## Structural rules

Prefer:

- feature-oriented structure
- reusable CRM UX patterns
- small focused components and hooks
- typed API boundaries

Avoid:

- business logic inside `src/App.tsx`
- oversized route components
- duplicated UI patterns
- global state without a demonstrated cross-feature need

Preserve Mantine and Onest. Do not introduce a parallel design system.

---

## Required validation

Use the root verification harness. Its canonical frontend area must perform a
locked install, dependency audit, lint, type checking, raw-color checks, unit
tests, and production build. Command definitions live only in
`scripts/harness/commands.py`.

If a flow or interface changed:

- run affected Playwright tests;
- include affected target-iPhone Playwright projects in the task verification contract;
- verify the primary task, one representative failure path, and one
  permission-restricted path;
- report Safari, browser-chrome, software-keyboard, safe-area, Simulator, and
  physical-device checks that remain unverified.

Follow the viewport and compact-height matrix from
`.agents/skills/crm-interface-design/references/mobile-acceptance.md` rather than maintaining a second
copy here.

---

## Code review rules

Flag:

- permissions, membership, attendance, or validation rules computed in frontend
- API types or error mapping that drift from backend responses
- new workflows missing loading, empty, error, disabled, restricted, or success states
- primary operations hidden in overflow or unreachable on the mobile baseline
- fixed/sticky controls that can collide with safe areas or keyboard-reduced viewports
- duplicated feature UI that should use an established shared pattern

Prefer behavior and accessibility findings over style preferences already
enforced by lint, raw-color checks, or the design system.

---

## Preferred capabilities

When available, prefer:

- react-specialist
- ui-designer
- ux-researcher
- refactoring-specialist
- test-automator

The required UX and implementation outcomes do not depend on a particular
agent topology.
