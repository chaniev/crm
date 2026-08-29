# TASK-155: Реализовать runtime customer branding и управление после деплоя

## Status
risky

## Requirements
- REQ-NFR-005 — implements
- REQ-BRN-002 — constrains
- REQ-AUD-001 — constrains

## Goal
Новый клуб получает валидированную палитру при деплое без отдельного frontend
release, а уполномоченный пользователь может безопасно изменить branding в
CRM после деплоя.

## Context
TASK-148 принял расширенную customer-branding boundary. Текущая реализация
TASK-090 выбирает только заранее собранные frontend profiles по opaque ID и
использует invariant neutral/auth colors, поэтому она реализует новую редакцию
REQ-NFR-005 лишь частично.

## User role
Оператор deployment; Главный тренер, Супер-администратор и Администратор в
рамках backend-owned доступа к разделу «Настройки»; все пользователи CRM как
потребители эффективной темы.

## Problem
Customer-specific палитра сейчас требует регистрации во frontend bundle, auth
action не следует customer primary color, neutral foundation неизменяема, а
после деплоя branding нельзя отредактировать через CRM.

## Scope
- Определить versioned validated runtime schema для club name, primary,
  secondary/accent, neutral roles и auth background selection.
- Принимать исходную branding configuration при деплое без customer-specific
  frontend build.
- Добавить backend-owned persistence и API управления branding через раздел
  «Настройки» после деплоя.
- Применять существующие разрешения раздела «Настройки» и обязательный audit к
  изменениям branding.
- Передавать frontend только нормализованный safe branding contract без
  произвольных CSS/style rules.
- Строить auth primary action из customer primary color.
- Применять customer-specific neutral surfaces/text/borders с contrast gate.
- Сохранить deterministic fallback на bundled defaults для unknown, invalid,
  incomplete или broken configuration.
- Мигрировать текущие `themeId`/`authBackgroundImageId` deployments без
  внезапного визуального изменения.

## Out of scope
- Logo и favicon — TASK-156.
- Arbitrary customer CSS, remote asset URL или binary data в public config.
- Dark mode, role-specific themes и изменение functional status palette.
- Изменение permissions, operation order, typography, density или responsive
  behavior ради branding.

## Constraints
- Backend владеет validation, effective-config precedence, persistence,
  authorization и audit semantics.
- Database schema changes follow retained-database upgrade and rollback rules.
- Login остаётся доступным при ошибке config, persistence или theme resolution.
- Existing bundled profiles остаются безопасным compatibility/fallback path.
- Implementation plan обязан явно описать deploy baseline, stored override,
  reset и rollback sequence до изменения runtime-кода.

## Acceptance criteria
- [ ] Новый валидный customer profile вводится при деплое без frontend release.
- [ ] Branding можно прочитать и изменить в CRM только через backend-permitted settings flow.
- [ ] Каждое изменение branding валидируется и записывается в audit log.
- [ ] Auth primary action использует customer primary color.
- [ ] Customer-specific neutral roles применяются без contrast/accessibility regression.
- [ ] Functional status meaning и status colors не переназначаются.
- [ ] Unknown, invalid, incomplete и broken configuration дают bundled defaults и не блокируют login.
- [ ] Upgrade существующего deployment сохраняет текущую тему до явного изменения.
- [ ] Rollback к bundled defaults и к предыдущей валидной конфигурации проверен.

## Test checklist
- [ ] Backend contract/authorization/validation/audit tests для settings mutations.
- [ ] Persistence migration tests для clean bootstrap и retained database.
- [ ] Frontend unit tests для runtime schema, auth action, neutral roles и fallback.
- [ ] Playwright для deploy baseline, post-deploy edit, reload, invalid config и login fallback.
- [ ] Contrast matrix для primary action и customer-specific neutrals.
- [ ] Проверить обе Compose-конфигурации и documented deployment inputs.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: cross-layer задача меняет deployment/runtime contract, persistence,
  settings authorization, audit и auth bootstrap fallback.

## Clarification questions
Не требуется на уровне продукта. Implementation plan должен остановиться при
неоднозначности deploy/stored precedence, reset/rollback sequencing или
ownership существующих active theme tasks.

## Source notes
- Source: explicit product-owner decisions in direct conversation on 2026-08-29.
- Original decisions: auth action uses primary; customer-specific neutrals are
  allowed; initial branding is configured at deployment; post-deploy branding
  is configured in CRM; unknown/broken config falls back to bundled defaults.
- Parent decision: TASK-148.

## Processing notes
- Created at: 2026-08-29 17:13 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 is the completed registry-based foundation;
  TASK-147 hardens the current profile schema but intentionally does not own
  runtime settings, neutral/auth expansion, persistence or authorization.
- Classification: risky because deployment, database, authorization, audit and
  auth availability require a coordinated reviewed implementation plan.

