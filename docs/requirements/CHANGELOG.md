# Журнал изменения требований

Обратохронологический список изменений карточек в `docs/requirements/`.
Каждое изменение требований фиксируется задачей, которая его внесла.

Формат строки:

```
- ДД.ММ.ГГГГ — REQ-ДОМЕН-NNN — <что изменилось: новая | текст | решение | реализация> (задача <ссылка>)
```

## 2026-09-02

- 02.09.2026 — REQ-USR-003 — регистронезависимый вход реализован через
  нормализованный login identity ключ с каноническим логином в
  session/audit/UI; реализация переведена в «реализовано» после интеграции
  TASK-166 в `main` (задача
  [TASK-166](../../backlog/done/TASK-166-case-insensitive-login.md)).
- 02.09.2026 — REQ-USR-002 — регистронезависимая уникальность логина
  реализована на PostgreSQL unique barrier с единой field-level ошибкой дубля;
  остальная часть карточки остаётся «частично» (задача
  [TASK-166](../../backlog/done/TASK-166-case-insensitive-login.md)).

## 2026-09-01

- 01.09.2026 — REQ-ATT-006 — today worklist уточнён до action-only
  занятий с `unmarkedClientCount > 0`; закреплены исключённые
  состояния, порядок, partial-result и правила актуализации (уточнение
  [TASK-168](../../backlog/implementation/TASK-168-attendance-today-worklist.md)).
- 01.09.2026 — REQ-NFR-007 — текст уточнён: resource migration охватывает все
  отображаемые пользователю статические тексты независимо от языка, завершается
  только после переноса всех выявленных текстов и не меняет их форматирование
  (задача [TASK-165](../../backlog/risky/TASK-165-user-facing-text-resources.md)).
- 01.09.2026 — REQ-USR-002 — для обычного и конкурентного создания
  case-only дубля закреплена единая field-level ошибка
  «Пользователь с таким логином уже существует.» (уточнение
  [TASK-166](../../backlog/done/TASK-166-case-insensitive-login.md)).

## 2026-08-30

- 30.08.2026 — REQ-NFR-005 — auth-экран закреплён как потребитель
  semantic color roles дизайн-системы; customer-specific background и
  primary action остаются в scope runtime branding (уточнение
  [TASK-169](../../backlog/done/TASK-169-start-screen-colors.md), implementation owner
  [TASK-155](../../backlog/risky/TASK-155-runtime-customer-branding.md)).
- 30.08.2026 — REQ-NFR-007 — новая принятая карточка обязательного
  layer-owned resource contract для всех user-facing статических текстов;
  реализация отмечена «частично» (задача
  [TASK-165](../../backlog/risky/TASK-165-user-facing-text-resources.md)).
- 30.08.2026 — REQ-USR-002, REQ-USR-003 — login identity и вход приняты
  регистронезависимыми; реализация переведена в «частично» до безопасного
  uniqueness/retained-database barrier (задача
  [TASK-166](../../backlog/done/TASK-166-case-insensitive-login.md)).
- 30.08.2026 — REQ-GRP-007 — нормативная подпись schedule action изменена с
  `Посещаемость` на `Посещение`; реализация переведена в «частично» (задача
  [TASK-167](../../backlog/implementation/TASK-167-schedule-attendance-label.md)).
- 30.08.2026 — REQ-ATT-006 — принят task-first landing `/attendance` со
  списком занятий на сегодня, быстрым входом и счётчиком `Не отмечено`;
  реализация переведена в «частично» (задача
  [TASK-168](../../backlog/implementation/TASK-168-attendance-today-worklist.md)).
- 30.08.2026 — REQ-GRP-007 — TASK-157 интегрирована в `main`;
  mobile-density contract покрыт component/Chromium/target-iPhone WebKit
  evidence, реализация переведена в «реализовано» (задача
  [TASK-157](../../backlog/done/TASK-157-schedule-mobile-density.md)).
- 30.08.2026 — REQ-GRP-001 — мобильная list-row композиция реестра
  сохранила decision-данные группы без изменения статуса
  требования (задача
  [TASK-164](../../backlog/done/TASK-164-groups-vertical-budget.md)).
- 30.08.2026 — REQ-NFR-001 — для реестра групп реализован
  проверяемый мобильный вертикальный бюджет; общая реализация
  требования осталась «частично» (задача
  [TASK-164](../../backlog/done/TASK-164-groups-vertical-budget.md)).
- 30.08.2026 — REQ-NFR-001 — текст дополнен принятым list-row/focus-card
  контрактом; representative Users/Audit slices и mobile radius overrides
  реализованы, общая реализация требования остаётся «частично» (задача
  [TASK-160](../../backlog/done/TASK-160-list-row-surfaces.md)).

## 2026-08-29

- 29.08.2026 — REQ-GRP-007 — принята mobile-density редакция с компактными
  строками занятий, усиленной decision-data hierarchy и единым action emphasis;
  реализация переведена в «частично» до TASK-157 (задача
  [TASK-157](../../backlog/tasks-ready/TASK-157-schedule-mobile-density.md)).
- 29.08.2026 — REQ-NFR-001 — semantic typography contract реализован в
  shared/representative frontend slices; Onest roles, iPhone form-control
  minimums, long-content wrapping and numeric tabular alignment стали
  проверяемым theme/CSS контрактом, общая реализация требования остаётся
  «частично» (задача
  [TASK-146](../../backlog/done/TASK-146-typography-scale.md)).
- 29.08.2026 — REQ-NFR-001 — reduced-motion contract реализован и
  подтверждён unit/Chromium/WebKit evidence; общая реализация
  требования остаётся «частично» (задача
  [TASK-144](../../backlog/done/TASK-144-reduced-motion-contract.md)).
- 29.08.2026 — REQ-NFR-001 — текст дополнен принятым
  reduced-motion contract; реализация переведена в «частично» (задача
  [TASK-144](../../backlog/done/TASK-144-reduced-motion-contract.md)).
- 29.08.2026 — REQ-NFR-005 — текст customer branding расширен:
  приняты runtime/deployment onboarding, post-deploy CRM settings,
  primary auth action, customer-specific neutrals, logo/favicon и bundled
  fallback; реализация переведена в «частично» (задача
  [TASK-148](../../backlog/done/TASK-148-customer-branding-boundary.md)).
- 29.08.2026 — REQ-GRP-007 — реализация task-first представления расписания подтверждена в `main` (задача [TASK-133](../../backlog/done/TASK-133-schedule-task-first-cards.md)).

## 2026-08-28

- 28.08.2026 — REQ-GRP-007 — новая принятая карточка task-first представления
  расписания (задача [TASK-133](../../backlog/done/TASK-133-schedule-task-first-cards.md)).
- 28.08.2026 — реестр — продуктовое решение отделено от состояния реализации;
  добавлены обязательные task metadata, approval gate и CI validation
  (задача [TASK-134](../../backlog/done/TASK-134-requirements-workflow.md)).

## 2026-08-27

- 27.08.2026 — миграция — содержание `MVP-ТЗ.md` и `BOT-МЕССЕНДЖЕР-ТЗ.md`
  перенесено в карточки, уточнено по `backlog/done` (TASK-001…TASK-130);
  карточки переведены в статус `реализовано`, отложенные сценарии бота
  (REQ-BOT-005, REQ-BOT-006) — `принято`; ТЗ перенесены в `docs/archive/`.
  Существенные отличия от MVP-ТЗ: роли (+SuperAdministrator, Администратор
  отмечает посещения по разрешениям), филиалы и залы, каталог абонементов
  и продажи/возвраты, отмена ручной отметки оплаты, целевые группы
  абонементов и пересечения, календарь занятий, замещения тренеров,
  порог внимания 3 дня, чат с клиентами. Полный список — в карточках ниже
  по доменам.
- 27.08.2026 — каркас реестра — реестр создан; карточки-примеры отмечены
  статусом `предложено` до полной миграции из `docs/MVP-ТЗ.md` и backlog.
