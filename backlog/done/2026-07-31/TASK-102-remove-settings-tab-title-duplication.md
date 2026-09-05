# TASK-102: Убрать дублирование названий вкладок в «Настройках»

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-31 19:22
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-31/TASK-102-remove-settings-tab-title-duplication.plan.md
- implementation_branch: fix/TASK-102-remove-settings-tab-title-duplication
- implementation_state: completed
- implementation_commit: f83065c
- delivered_on_main_at: 2026-07-31
- moved_to_done_at: 2026-07-31
- last_status_reviewed_at: 2026-07-31

## Goal
Пользователь сразу видит рабочие действия и содержимое выбранной вкладки «Настроек» без повторного названия этой же вкладки внутри панели.

## Context
Во вкладке `Настройки → Абонементы` после названия вкладки дополнительно показан заголовок `Каталог абонементов`. Аналогичный паттерн есть в остальных доступных пользователю вкладках: `Типы групп`, `Филиалы и залы` и `Администраторы` повторно выводят название через `SectionHeader` перед рабочими действиями и данными.

Текущий source inventory подтверждает четыре embedded-панели в `SettingsScreen`: `MembershipCatalogSettings`, `GroupTypesSettingsPanel`, `BranchSettingsScreen` и `AdministratorsSettingsPanel`. Завершённая TASK-095 задала общий запрет на дублирующие route/section titles, но эти settings-панели остались непокрытым follow-up.

## User role
Главный тренер / суперадминистратор / администратор с разрешённым backend-доступом к соответствующей вкладке.

## Problem
Повторный заголовок не добавляет контекста к уже выбранной и видимой вкладке, занимает вертикальное пространство и отодвигает основные операции, список и состояния загрузки из первого viewport.

## Scope
- Убрать из embedded-панелей `/settings` видимые standalone-заголовки, которые только повторяют выбранную вкладку: `Каталог абонементов`, `Типы групп`, `Филиалы и залы`, `Администраторы`.
- Сохранить названия и active state самих вкладок.
- Сохранить действия добавления и обновления и разместить их как компактную operational toolbar без пустого header-контейнера.
- Сохранить действительно необходимый контекст полей, ограничений и recovery рядом с соответствующим control или состоянием; не заменять удалённые заголовки новой декоративной copy.
- Сохранить доступное имя и связь каждой tab panel с её вкладкой без видимого дублирования.
- Сохранить самостоятельный route-level заголовок `BranchSettingsScreen`, когда экран открыт вне embedded-контекста `SettingsScreen`.
- Обновить component и responsive Playwright regression coverage для всех доступных settings-вкладок.

## Out of scope
- Переименование, удаление или перестановка вкладок «Настроек».
- Изменение membership catalog, group type, branch, hall или administrator CRUD.
- Изменение ролей, permissions, маршрутов, backend contracts или бизнес-правил.
- Общий редизайн `SettingsScreen`, shared tabs или дизайн-системы.
- Удаление заголовков форм, modal, loading, empty, error, permission-restricted и recovery states.

## Constraints
- Backend остаётся единственным владельцем permissions и CRM-семантики.
- Primary и frequent actions остаются видимыми и доступными; операция не должна уходить в overflow из-за удаления заголовка.
- Tab panel сохраняет семантическое доступное имя, корректный focus order и keyboard navigation.
- Не оставлять пустые wrapper-ы, лишние отступы или action-only вторую строку.
- На mobile toolbar остаётся в одну строку там, где это предусмотрено shared-паттерном; icon-only action сохраняет доступное имя и touch target не менее `44 x 44px`.
- Изменение ограничено локальной frontend-коррекцией и не возвращает copy, удалённую TASK-095.

## Acceptance criteria
- [x] В `Настройки → Абонементы` внутри активной панели нет видимого standalone-заголовка `Каталог абонементов`; сразу доступны relevant branch context, действия и operational state/list.
- [x] В панелях `Типы групп`, `Филиалы и залы` и `Администраторы` нет видимого заголовка, повторяющего название активной вкладки.
- [x] Названия вкладок, их active state, permission-based visibility и keyboard navigation не изменены.
- [x] Действия `Добавить…` и `Обновить` остаются видимыми, имеют прежние accessible names и запускают прежние операции.
- [x] Loading, empty, error, disabled, success и permission-restricted states сохранены; их собственные информативные заголовки не удалены.
- [x] Embedded `BranchSettingsScreen` не повторяет название вкладки, а standalone-вариант сохраняет route-level заголовок `Филиалы и залы`.
- [x] Удаление заголовков не оставляет пустых контейнеров или лишнего вертикального отступа перед первым operational block.
- [x] На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768` и `1440 px` нет horizontal page scroll, clipping, перекрытий или недостижимых основных действий.

## Test checklist
- [x] Обновить `SettingsScreen` component tests: для каждой разрешённой вкладки проверять отсутствие повторного видимого panel title при сохранённых tab, actions и operational states.
- [x] Обновить `MembershipCatalogSettings`, `BranchSettingsScreen` и administrator settings tests, затронутые изменением header-контракта.
- [x] Проверить отдельный route `BranchSettingsScreen`: standalone heading сохранён, embedded heading отсутствует.
- [x] Добавить или обновить affected Playwright checks для всех settings-вкладок на mobile, compact-height, tablet и desktop.
- [x] Проверить keyboard-переход между tabs, focus order и visible focus у toolbar actions.
- [x] Запустить `cd frontend && npm run test:unit`.
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Запустить affected Playwright specs и target iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend-коррекция удаляет только дублирующие видимые заголовки и сохраняет операции, состояния, permissions и backend contracts.

## Clarification questions
Не требуются: исходная заметка однозначно указывает на повтор названия выбранной вкладки и распространяет исправление на остальные вкладки «Настроек»; текущий source inventory подтверждает одинаковый паттерн.

## Source notes
- Source file: `backlog/processed/2026-07-31.md`
- Original note: `Настройка-Абоненменты осталось дублирование название вкладки`
- Original note: `аналогично в других разделах вкладки Настройки`

## Processing notes
- Created at: 2026-07-31 19:15
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата в `tasks-ready`, `risky` и `needs-clarification` нет; завершённая TASK-095 задала общий anti-duplication контракт, но текущие settings-панели остались конкретным непокрытым follow-up. TASK-101 удаляла metric widgets и не покрывает tab-title duplication.

## Completion record
- Completed on: 2026-07-31.
- Implementation commit: `f83065c`.
- Validation: frontend lint, build, raw-color check, 413 unit tests, 64 affected Chromium Playwright tests and 32 target-iPhone WebKit tests passed.
- Data storage: backend and database structure were not changed; migration is not required.
- Runtime: no Docker Compose task stack was created because the plan required static, component and mocked browser validation only.
- Residual device evidence: physical Safari chrome, software keyboard, safe-area, iOS Simulator and physical-device checks were not performed.
