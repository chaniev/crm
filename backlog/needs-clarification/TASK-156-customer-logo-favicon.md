# TASK-156: Добавить customer logo и favicon

## Status
needs-clarification

## Requirements
- REQ-NFR-005 — implements

## Goal
CRM использует customer-specific logo и favicon с безопасным fallback и без
ухудшения доступности или стабильности auth/shell.

## Context
TASK-148 включил logo и favicon в принятую customer-branding boundary и явно
потребовал вынести их в отдельную задачу. Текущая реализация поддерживает club
name, theme profile и auth background, но не logo/favicon.

## User role
Оператор deployment; уполномоченный пользователь раздела «Настройки»; все
пользователи CRM.

## Problem
Без отдельного asset contract реализация должна была бы придумать места
показа, варианты логотипа, способ поставки и хранения, cache invalidation и
fallback для повреждённых assets.

## Scope
- Определить поддерживаемые logo placements и favicon/browser surfaces.
- Определить asset formats, размеры, варианты и accessibility semantics.
- Определить deploy-time и post-deploy source/storage contract.
- Реализовать validation, versioning/cache invalidation и deterministic fallback.
- Синхронизировать public resolved branding contract и CRM settings flow.

## Out of scope
- Произвольные remote URL, binary payload или inline SVG через public config.
- Домены, email templates, PWA redesign и маркетинговые страницы.
- Изменение layout/action hierarchy ради размещения логотипа.

## Constraints
- Broken или отсутствующий asset использует bundled logo/favicon fallback и не
  блокирует login или authenticated shell.
- Asset ownership/license, content-type, size и безопасная обработка обязательны.
- Logo не заменяет accessible club name там, где текст нужен для понимания.
- Реализация координируется с TASK-155 и не создаёт второй settings/config path.

## Acceptance criteria
- [ ] Logo placements и favicon surfaces явно утверждены.
- [ ] Форматы, размеры, варианты и source/storage policy утверждены.
- [ ] Valid asset обновляется при деплое и/или через разрешённый settings flow согласно решению.
- [ ] Broken/missing asset детерминированно использует bundled fallback.
- [ ] Cache invalidation показывает новую версию без ручной очистки browser cache.
- [ ] Auth, shell и responsive layout сохраняют доступность и геометрию.

## Test checklist
- [ ] Validation tests для разрешённых и запрещённых asset payloads.
- [ ] Authorization/audit tests, если assets изменяются через CRM settings.
- [ ] Browser tests для logo placements, favicon refresh и broken-asset fallback.
- [ ] Mobile/desktop visual review и accessible-name проверка.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: asset upload/storage and browser caching require explicit product and
  security decisions before implementation.

## Clarification questions
- [ ] Где обязателен logo: auth card, authenticated header/navigation или оба места?
- [ ] Нужны ли отдельные full logo и compact mark либо один адаптивный asset?
- [ ] Какие форматы разрешены: raster only или валидированный SVG тоже?
- [ ] Assets задаются только при деплое, загружаются после деплоя через CRM UI или поддерживаются оба пути?
- [ ] Должен ли favicon включать только browser icon или также web-app/Apple touch icons?

## Source notes
- Source: explicit product-owner decision in direct conversation on 2026-08-29.
- Original decision: «заведи отдельную задачу» для logo и favicon.
- Parent decision: TASK-148; runtime/settings dependency: TASK-155.

## Processing notes
- Created at: 2026-08-29 17:13 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-049 explicitly excluded logo/favicon; TASK-090 owns
  registered auth backgrounds only; no active task owns customer logo/favicon.
- Classification: needs-clarification because placements, variants, accepted
  formats and asset source/storage materially change implementation and risk.

