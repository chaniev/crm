# Журнал изменения требований

Обратохронологический список изменений карточек в `docs/requirements/`.
Каждое изменение требований фиксируется задачей, которая его внесла.

Формат строки:

```
- ДД.ММ.ГГГГ — REQ-ДОМЕН-NNN — <что изменилось: новая | текст | решение | реализация> (задача <ссылка>)
```

## 2026-08-30

- 30.08.2026 — REQ-GRP-007 — task-branch candidate TASK-157 реализует
  mobile-density contract и покрыт component/Chromium/target-iPhone WebKit
  evidence; реализация остаётся «частично» до интеграции в `main` (задача
  [TASK-157](../../backlog/implementation/TASK-157-schedule-mobile-density.md)).
- 30.08.2026 — REQ-NFR-001 — текст дополнен принятым list-row/focus-card
  контрактом; representative Users/Audit slices и mobile radius overrides
  реализованы, общая реализация требования остаётся «частично» (задача
  [TASK-160](../../backlog/implementation/TASK-160-list-row-surfaces.md)).

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
