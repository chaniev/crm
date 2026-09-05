# TASK-165: Вынести пользовательские тексты в файлы ресурсов

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-09-05
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/TASK-165-user-facing-text-resources.plan.md
- implementation_branch: refactor/TASK-165-user-facing-text-resources
- verification_contract: /backlog/done/TASK-165-user-facing-text-resources-verification-contract.json

## Implementation progress

- 2026-09-05 — accepted inventory baseline recorded 2,762 entries and 3,161
  occurrences across 25 bounded layer/feature slices, 191 reviewed duplicate
  groups and an empty exact allowlist.
- 2026-09-05 — extracted frontend, backend and bot copy into typed feature
  modules or producing-assembly resources; machine contracts, telemetry,
  fixtures, dynamic values and persisted history retained their original
  ownership.
- 2026-09-05 — final inventory recorded 2,809 entries and 3,235 occurrences,
  with zero Cyrillic and zero non-Cyrillic user-facing resource candidates
  outside resource boundaries. TypeScript, Roslyn and Python AST guards are
  wired into the canonical harness; the full task verification contract passed.

## Requirements
- REQ-NFR-007 — implements

## Goal
Все статические тексты, которые CRM показывает пользователю, имеют явного
resource-владельца в соответствующем слое, а последующие доработки не добавляют
новые пользовательские литералы напрямую в production-компоненты и сервисы.

## Context
В проекте уже есть `frontend/src/lib/resources.ts`, bot resources и backend
`.resx`/helper-классы, но resource adoption неполный: пользовательские тексты
остаются распределены по frontend, backend и bot production-коду. Inbox также
требует закрепить этот подход отдельным требованием для будущих изменений.

## User role
Система / все пользователи CRM и Telegram-бота.

## Problem
Hardcoded пользовательские тексты затрудняют согласованное изменение copy,
создают дубли и позволяют разным слоям показывать разные формулировки одного
состояния.

## Scope
- Составить inventory статических user-facing текстов во frontend, backend и bot
  и разделить их на resource candidates, machine-readable constants и
  допустимые динамические значения.
- Перенести frontend copy в типизированные resource-модули, backend
  ProblemDetails/validation/display copy — в domain-owned `.resx` helpers, bot
  messages/keyboards — в bot resource modules.
- Зафиксировать проверяемое правило для новых изменений и узкий allowlist там,
  где литерал является тестовыми данными, техническим кодом или частью
  протокола.
- Сохранить source ownership: backend остаётся владельцем CRM validation и
  ProblemDetails semantics, consumers не воспроизводят их самостоятельно.
- Разбить миграцию на проверяемые slices, если единый change-set становится
  слишком большим для безопасного review.

## Out of scope
- Добавление второго языка или runtime-переключателя локали.
- Переписывание утверждённого product copy без отдельного требования.
- Перенос route paths, enum values, audit action codes, callback payloads и
  других machine-readable contracts в текстовые resources.
- Перезапись исторических audit records или production data.

## Constraints
- Механический перенос сохраняет видимый текст и поведение; содержательные
  изменения copy оформляются отдельным requirement change.
- Resource extraction не меняет HTTP status, ProblemDetails fields, API DTO,
  authorization, attendance, membership или payment semantics.
- Сканер не должен требовать resource extraction для тестовых fixtures,
  telemetry-only сообщений и machine-readable identifiers.
- Исторические persisted descriptions не мигрируются без отдельного data plan.

## Acceptance criteria
- [x] Inventory покрывает frontend, backend и bot и фиксирует владельца каждой категории текста.
- [x] Новые и затронутые user-facing строки читаются из layer-appropriate resources.
- [x] Machine-readable contracts не замаскированы под локализуемый текст.
- [x] Проверка или документированный review gate предотвращает новые неразрешённые user-facing literals.
- [x] Representative frontend, API ProblemDetails и bot scenarios показывают прежний смысл и проходят regression tests.
- [x] Миграционные slices и исключения имеют явную ownership/traceability запись.

## Test checklist
- [x] Добавить characterization tests для representative frontend, backend и bot copy до переноса.
- [x] Запустить canonical validation каждого затронутого producer/consumer слоя.
- [x] Проверить scanner/allowlist на истинно пользовательском литерале и на допустимом machine code.
- [x] Проверить русский текст, plural/count copy и fallback при отсутствующем resource key.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: broad cross-layer migration затрагивает public error copy, audit display,
  frontend и bot; её нужно декомпозировать и проверять без изменения контрактов.

## Clarification questions
Не требуется для планирования; slice boundaries определяются inventory и не
разрешают менять product copy.

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `вынести весь текст отображаемый пользователю в файлы ресурсов, добавить соответствующее требование для последующих доработок`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: completed `REFACTORING_PLAN.md` introduced partial backend/frontend resources but explicitly left residual areas; no active task owns complete cross-layer user-facing text adoption. TASK-150 owns shared component/color migration, not copy resources.
- Classification: risky because the requested all-layer migration is broad and can alter public error/audit/bot text if implemented without characterization and slice review.
- 30.08.2026 — user decision: scanner detection ограничена кириллическим видимым copy (названия кнопок, пункты меню, подсказки); текст, вводимый пользователем, не входит. Реализация блокируется до завершения и интеграции TASK-167 и TASK-168 (см. dependencies плана).
- 05.09.2026 — prepared proposed review baseline on integrated commit `dfe9501`:
  literal-level inventory shards, cross-owner duplicate report, empty scanner
  allowlist and bounded layer/feature decomposition are linked from the plan.
  Baseline remains unaccepted; extraction has not started.
- 05.09.2026 — product owner accepted all baseline proposals: classifications,
  duplicate defaults, empty allowlist and layer/feature decomposition. Task
  moved to implementation and extraction is authorized within those bounds.
- 05.09.2026 — all accepted slices completed; final independent inventory has
  no remaining user-facing resource candidates outside resources, and the
  repository-wide verification contract passed.
