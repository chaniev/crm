# TASK-181: Сделать переходы между разделами настоящими ссылками

## Status
done

## Requirements
- REQ-NFR-001 — implements

## Requirement links
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md) — implements

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
- [x] Разрешённый маршрут открывается в новой вкладке и доступен через контекстное меню копирования.
- [x] Back/forward, активный раздел, focus return и backend-driven доступ не меняются.

## Test checklist
- [x] Обычный и модифицированный клик, middle click, прямой URL, restricted route, mobile overflow.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Замена семантики навигационного элемента при тех же маршрутах и правах.

## Evidence
- [frontend/src/features/shared/MobileBottomNavigation.tsx](../../../frontend/src/features/shared/MobileBottomNavigation.tsx)
- [frontend/src/lib/appRoutes.ts](../../../frontend/src/lib/appRoutes.ts)
- [docs/MOBILE_UI_CONTRACT.md](../../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../../processed/2026-09-30.md)
- Source items: 12 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> сделать навигацию ссылками вместо кнопок при реальных URL (/attention, /coaches, …) — сейчас не работают открытие в новой вкладке и копирование ссылки, aria-current при этом есть

### Дополнение из аудита 20.11.2026

- Source file: [00-navigation](../../processed/2026-11-20-interface-audit/00-navigation/README.md)
- NAV-02: переходы разделов представлены кнопками, нативное открытие раздела в новой вкладке не предоставляется.

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-024/051/090 создали shell, TASK-126 его разделила; новой задачи на native links нет. TASK-058 про отдельные окна/второй монитор и не является дубликатом.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

- Updated at: 2026-11-20 19:43 (Europe/Moscow); mode: triage, аудит интерфейса 20.11.2026.
- Прямое подтверждение существующего scope. Выбор четвёртого пункта мобильного меню отделён в TASK-209; он не блокирует семантику уже существующих URL.

## Planning review 2026-11-20
- Актуальность: MobileBottomNavigation использует UnstyledButton type=button и onNavigate для существующих маршрутов; getRoutePath в appRoutes уже определяет URL.
- Проверка: статический анализ текущего main и сохранённого аудита; новая runtime-приёмка не выполнялась.
- readiness: yes

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-20
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-21/TASK-181-native-navigation-links.plan.md
- implementation_branch: codex/TASK-181-native-navigation-links

## Completion
- completed_at: 2026-11-21
- completion_date_evidence: интеграция проверенной версии `7945a10` в локальную main 2026-11-21.
- [Приёмка и ограничения проверки](TASK-181-evidence/acceptance.md)
