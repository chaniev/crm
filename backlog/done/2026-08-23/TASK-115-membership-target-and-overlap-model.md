# TASK-115: Определить адресность и одновременное действие абонементов

## Status
done

## Goal
Дать администратору и главному тренеру возможность привязать абонемент клиента
к упорядоченному набору групп, сохранив однозначные правила доступа к занятиям,
пересечений, attendance, списаний, переносов и финансовой отчётности.

## Context
В исходных заметках связаны три симптома: при оформлении нельзя выбрать
конкретное занятие, второй абонемент завершается ошибкой, а разовую тренировку
нельзя добавить при действующем абонементе.

Текущий каталог принадлежит филиалу, `ClientMemberships` защищены ограничением
непересекающихся периодов одного клиента, а `SingleVisit` списывается через
attendance. Поэтому поддержка нескольких параллельных абонементов и нескольких
групп одного абонемента требует согласованного backend-контракта, а не только
изменения формы.

Первоначальная one-group модель была заменена продуктовым решением от
2026-08-21: `Term` может относиться к одной–пяти группам, `SingleVisit` — ровно
к одной, а `Professional` сохраняет глобальный охват всех филиалов при
одной–пяти target groups. Все связанные multi-group правила ниже подтверждены
пользователем.

## User role
Администратор / главный тренер; затронут также тренер при отметке посещения.

## Confirmed product decisions

### Target groups and coverage

- Набор групп абонемента упорядочен; первая группа является основной группой
  финансовой и операционной отчётности.
- `Term` должен содержать от одной до пяти групп.
- `SingleVisit` должен содержать ровно одну группу.
- `Professional` должен содержать от одной до пяти групп для адресности и
  отчётности, но право посещения по-прежнему распространяется на все группы
  всех филиалов.
- Все выбранные группы одного абонемента должны принадлежать одному филиалу.
- Доступность групп для роли определяется существующими backend-owned
  permission и scope rules.
- Количество выбранных групп не влияет на цену абонемента.
- Связь с группой означает право посещать занятия этой группы и использование
  группы в отчётности; для `Professional` глобальный охват является явным
  исключением.

### Overlap, eligibility and attendance

- Наличие двух target groups у одного абонемента не меняет прежние правила
  одновременного действия абонементов: правило применяется к каждой покрываемой
  группе.
- Пересекающиеся по времени обычные абонементы запрещены, если их наборы групп
  пересекаются хотя бы по одной группе. Например, `[A, B]` конфликтует с
  `[B, C]`, но может действовать одновременно с абонементом `[C]`.
- Для одной группы одновременно может действовать не более одного `Term` или
  `SingleVisit`; абонементы с непересекающимися наборами групп могут действовать
  параллельно.
- `Professional` нельзя совмещать по времени ни с одним другим абонементом,
  включая второй `Professional`, независимо от выбранных target groups.
- Overlap matrix должна гарантировать, что для конкретного занятия существует
  не более одного подходящего entitlement. Пользователь не выбирает
  абонемент при attendance; backend определяет его по клиенту, группе и дате.
- `SingleVisit` даёт одно посещение только в своей единственной группе,
  действует без календарного срока до использования и восстанавливается при
  отмене связанного посещения по ранее подтверждённым правилам.
- Legacy-абонемент с пустым набором групп не предоставляет доступ, не выбирается
  для attendance и не участвует в списании до ручного исправления.

### Purchase, renewal, correction and transfer

- Продажа абонемента сохраняет весь выбранный упорядоченный набор групп и
  автоматически добавляет клиента в отсутствующие выбранные группы.
- Продление наследует весь набор и порядок групп исходного абонемента, но
  пользователь может изменить набор в пределах правил типа абонемента и
  одного филиала.
- Ошибочно выбранный набор можно исправить в существующем абонементе; прошлые
  события остаются привязаны к сохранённым snapshots.
- При переводе конкретная исходная группа заменяется целевой группой во всех
  затрагиваемых действующих и будущих абонементах. Например, перевод `A -> C`
  преобразует `[A, B]` в `[C, B]` с сохранением порядка остальных групп.
- Перенос применяется с момента операции: прошлые attendance, продажи,
  возвраты и отчёты сохраняют прежний snapshot набора групп.
- Перевод не создаёт новую продажу и не меняет цену или платёжные данные.

### Reporting and history

- Attendance, sale и refund сохраняют immutable snapshot упорядоченного набора
  групп, действовавшего на момент события.
- Для финансовых breakdowns событие относится к первой группе snapshot.
- Canonical sale/refund totals учитывают событие ровно один раз и не
  дублируются по всем группам абонемента.
- Изменение порядка или состава групп влияет только на новые события; старые
  snapshots и исторические отчёты не переписываются.
- Для `Professional` первая target group используется для финансовой
  атрибуции, несмотря на глобальный entitlement.

### Group archive

- Архивирование группы блокируется, если группа входит в набор хотя бы одного
  действующего или будущего абонемента.
- Истёкшие абонементы и исторические snapshots архивирование не блокируют.
- Перед архивированием все действующие и будущие ссылки на группу должны быть
  вручную перенесены или исправлены.

### Data transition and legacy records

- Существующая одиночная связь абонемента с группой преобразуется в
  упорядоченный набор из одного элемента.
- Для существующего абонемента без target groups используются все текущие
  группы клиента, только если их от одной до пяти и они принадлежат одному
  филиалу.
- Если у клиента нет групп, групп больше пяти либо они принадлежат разным
  филиалам, набор групп абонемента остаётся пустым.
- Существующие назначения клиента в группах сохраняются во всех случаях;
  автоматическая миграция не удаляет и не перестраивает их.
- Пустой legacy-набор сохраняется как явное исключение, не даёт доступ и
  требует ручного исправления через штатную membership operation.

## Problem
Текущая модель хранит и выбирает абонемент на уровне клиента, а не
упорядоченного набора групп. Без изменения backend-контракта несколько групп
создадут неоднозначность в overlap, attendance allocation, `SingleVisit`,
переносах, архивировании и финансовой истории.

## Scope

- Реализовать ordered target-group collection для `Term`, `SingleVisit` и
  `Professional` согласно подтверждённым ограничениям.
- Реализовать backend-owned overlap matrix и уникальный entitlement resolver.
- Обновить purchase, renew, correction, transfer, refund, attendance и group
  archive semantics.
- Сохранять исторические snapshots и атрибутировать финансовые события первой
  группе без двойного учёта canonical totals.
- Выполнить безопасный data transition с явным legacy empty-target state.
- Обновить backend contract, schema, ProblemDetails, audit, frontend, bot,
  initial DB state и regression coverage.
- Заменить устаревший one-group implementation plan новым test-first
  multi-group планом и провести human review перед реализацией.

## Out of scope

- Изменение цен в зависимости от количества групп.
- Разрешение нескольких групп для `SingleVisit`.
- Ограничение фактического охвата `Professional` выбранными target groups.
- Автоматическая очистка или сокращение существующих групп клиента при
  миграции.
- Снятие overlap constraint только во frontend или пользовательский выбор
  произвольного абонемента при attendance.
- Выполнение существующего one-group implementation plan.

## Constraints

- Backend остаётся единственным источником membership, attendance,
  permissions, audit и validation semantics.
- Нельзя допустить двойное списание, скрытый выбор entitlement, дублирование
  финансовых totals или переписывание исторических snapshots.
- Операции должны оставаться атомарными, идемпотентными и безопасными при
  конкурентных запросах.
- Порядок target groups является частью доменного контракта и должен устойчиво
  сохраняться в БД и API.
- Contract/schema change требует синхронно обновить frontend, bot, tests и
  воспроизводимый initial DB state.
- Новый `membership-overlap` должен соответствовать пересечению периодов и
  наборов групп, а также глобальному охвату `Professional`.

## Acceptance criteria

- [x] `Term` и `Professional` принимают 1–5 упорядоченных групп одного
  филиала; `SingleVisit` принимает ровно одну.
- [x] Цена не зависит от количества групп, а первая группа стабильно является
  reporting group.
- [x] Подтверждённая overlap matrix реализована для пересекающихся и
  непересекающихся наборов без неоднозначного entitlement.
- [x] Attendance выбирает entitlement на backend без пользовательского выбора,
  а `SingleVisit` списывается и восстанавливается ровно один раз.
- [x] Purchase, renew, correction и transfer сохраняют подтверждённый порядок,
  snapshots и effective-time semantics.
- [x] Архивирование блокируется действующими и будущими membership links, но
  не историческими snapshots.
- [x] Финансовые события относятся к первой группе snapshot и не дублируют
  canonical totals.
- [x] Data transition создаёт singleton/eligible multi-group sets и оставляет
  пустой заблокированный legacy set для неоднозначных данных без изменения
  назначений клиента.
- [x] API, ProblemDetails, audit, frontend и bot используют один согласованный
  multi-group контракт.
- [x] Устаревший one-group plan заменён test-first multi-group планом и прошёл
  human review до начала implementation.

## Test checklist

- [x] Добавить backend contract matrix для всех разрешённых и запрещённых
  сочетаний периодов, типов и наборов групп.
- [x] Проверить сохранение порядка для пяти групп и атомарный отказ при
  добавлении шестой группы без частичной записи/audit.
- [x] Проверить `[A, B]` против `[B, C]`, `[C]` и глобального `Professional`.
- [x] Проверить `SingleVisit` write-off/restore, atomicity, idempotency,
  concurrency и reload из БД.
- [x] Проверить purchase/renew/correction/transfer, сохранение порядка и
  immutable event snapshots.
- [x] Проверить archive guard для действующих, будущих и исторических записей.
- [x] Проверить migration cases: singleton, 2–5 групп одного филиала, без
  групп, больше пяти групп и группы разных филиалов.
- [x] Проверить неизменность client-group assignments и блокировку legacy
  empty-target membership.
- [x] Проверить финансовую атрибуцию первой группе без двойного учёта.
- [x] Проверить frontend primary workflow и bot/read consumers.

## AI safety

- Safe for Codex: no
- Risk level: high
- Reason: задача меняет membership cardinality, attendance allocation,
  persistence constraints, data transition, group archive и
  финансово-аудиторскую семантику. Продуктовый контракт определён, но до
  реализации необходимы новый test-first plan, human review и полный
  cross-layer regression barrier.

## Source notes

- Source file: `backlog/inbox/2026-08-16.md`
- Original note: `Нет возможности выбора, к какому именно занятию абонемент — идет общий абонемент`
- Original note: `Не дает добавить второй абонемент, выдает ошибку`
- Original note: `Разовую тренировку при действующем абонементе добавить невозможно, также выдает ошибку`
- Direct clarification (2026-08-19): подтверждена прежняя one-group модель,
  overlap, attendance, transfer, archive, legacy и refund semantics; решения
  сохранены как историческая основа, но cardinality заменена 2026-08-21.
- Source file: `backlog/inbox/2026-08-21.md`
- Original note: `абонемент может быть привязан к нескольким группам`
- Direct clarification (2026-08-21 12:48 MSK, superseded by later cardinality
  clarification): `Term` — 1–2 группы, `SingleVisit` — одна, `Professional` —
  глобальный охват при 1–2 target groups; все target groups одного филиала;
  количество групп не влияет на цену.
- Direct clarification (2026-08-21 16:38 MSK): верхняя граница target groups
  увеличена с двух до пяти. `Term` и `Professional` используют 1–5 ordered
  groups одного филиала; `SingleVisit` остаётся ровно одногрупповым. Остальные
  подтверждённые overlap, reporting, transfer, archive и snapshot rules не
  меняются.
- Direct clarification (2026-08-21): прежние overlap и attendance rules
  применяются к каждому покрываемому group target; пересекающиеся sets
  конфликтуют, entitlement остаётся однозначным, `SingleVisit` остаётся
  одногрупповым.
- Direct clarification (2026-08-21): renewal наследует изменяемый ordered set,
  transfer `A -> C` преобразует `[A, B]` в `[C, B]`, события сохраняют set
  snapshots, первая группа используется для отчётности.
- Direct clarification (2026-08-21): архивирование блокируют действующие и
  будущие ссылки; one-group мигрирует в singleton, допустимые текущие группы
  клиента назначаются без их удаления, неоднозначные legacy cases остаются с
  пустым набором и без eligibility до ручного исправления.

## Processing notes

- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата нет; завершённая TASK-078 исправляла
  разрешённые write-сценарии, но явно не разрешала несколько пересекающихся
  абонементов.
- Grouping: три исходных симптома объединены, потому что overlap и attendance
  allocation делают их одним backend-owned продуктовым решением.
- Clarification update (2026-08-19 22:37): one-group модель была полностью
  уточнена, задача переведена в `risky`, после чего для неё создан
  implementation plan.
- Inbox update (2026-08-21 12:05 MSK): multi-group заметка отменила ключевую
  one-group cardinality; задача возвращена в `needs-clarification`, а прежний
  план помечен superseded.
- Clarification update (2026-08-21 12:48 MSK): зафиксированы полный ordered
  multi-group контракт, overlap, attendance, lifecycle, reporting, archive и
  data-transition semantics. Открытых продуктовых вопросов не осталось;
  задача переведена из `needs-clarification` в `risky`. Старый one-group plan
  остаётся неисполняемым и должен быть заменён до implementation.
- Planning update (2026-08-21 12:59 MSK): superseded one-group plan полностью
  заменён test-first multi-group implementation plan. Карточка остаётся в
  `risky`; plan готов к обязательному human review, но active execution не
  разрешён до явного одобрения high-risk TASK-115 и выбора DB lifecycle.
- Clarification update (2026-08-21 16:38 MSK): максимальная cardinality для
  `Term`/`Professional` изменена с двух до пяти; task, acceptance/test checklist
  и implementation plan синхронизированы. Risk/status не меняются.

## Implementation lifecycle

- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/2026-08-23/TASK-115-membership-target-and-overlap-model.plan.md
- implementation_branch: feature/TASK-115-membership-target-and-overlap-model
- implementation_state: completed
- implementation_commits: 2715554
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record

- Completed on: 2026-08-23; validated implementation candidate: `2715554`.
- Backend now owns ordered 1–5 target sets, target-aware overlap and entitlement
  resolution, exact membership mutations, immutable sale/refund/attendance
  snapshots, archive guards and Position `0` financial attribution. Canonical
  reads expose `currentMemberships`; singular current-membership fields were
  removed from the production contract.
- Frontend and bot consume the same ordered collection contract. The primary
  mobile workflow supports ordered selection, five-target limits, recovery,
  multiple membership identities and target-aware transfer without attendance
  membership selection.
- Database lifecycle was confirmed as recreatable. The clean initial migration,
  model snapshot and designers were updated and verified against a fresh
  PostgreSQL volume; no preserved predecessor database or destructive data
  transition was in scope. Legacy empty-target behavior and transition buckets
  remain covered by domain/integration tests.
- Validation on the rebased candidate: backend build with warnings as errors,
  format, dependency audit and `452/452` tests; frontend lint, typecheck,
  raw-color scan, build and `545/545` unit tests; Chromium `15/15`; target-iPhone
  WebKit `44/44`; bot locked sync, Ruff, mypy and `61/61` tests; clean PostgreSQL
  migration/schema/health checks and the focused seven-test concurrency barrier.
- Residual manual evidence: physical Safari dynamic chrome, native controls,
  software keyboard and real-device safe-area behavior were not exercised.
