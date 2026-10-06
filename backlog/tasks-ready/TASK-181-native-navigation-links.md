# TASK-181: Сделать переходы между разделами настоящими ссылками

## Status
tasks-ready

## Requirements
- REQ-NFR-001 — implements

## Requirement links
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — implements

## Goal
У существующих маршрутов работают открытие в новой вкладке и копирование адреса.

## Context
MobileBottomNavigation рендерит переходы через UnstyledButton type="button" и onNavigate, хотя у разделов есть стабильные URL.

## Scope
- Использовать ссылки с href для переходов по реальным маршрутам в desktop/mobile shell и overflow.
- Сохранить client-side routing для обычного клика, native modifier/middle click и aria-current; кнопка «Ещё» остаётся действием открытия панели.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Разрешённый маршрут открывается в новой вкладке и доступен через контекстное меню копирования.
- [ ] Back/forward, активный раздел, focus return и backend-driven доступ не меняются.

## Test checklist
- [ ] Обычный и модифицированный клик, middle click, прямой URL, restricted route, mobile overflow.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Замена семантики навигационного элемента при тех же маршрутах и правах.

## Evidence
- [frontend/src/features/shared/MobileBottomNavigation.tsx](../../frontend/src/features/shared/MobileBottomNavigation.tsx)
- [frontend/src/lib/appRoutes.ts](../../frontend/src/lib/appRoutes.ts)
- [docs/MOBILE_UI_CONTRACT.md](../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 12 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> сделать навигацию ссылками вместо кнопок при реальных URL (/attention, /coaches, …) — сейчас не работают открытие в новой вкладке и копирование ссылки, aria-current при этом есть

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-024/051/090 создали shell, TASK-126 его разделила; новой задачи на native links нет. TASK-058 про отдельные окна/второй монитор и не является дубликатом.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
