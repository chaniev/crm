# TASK-102: Убрать дублирование названий вкладок в «Настройках»

## Status
ready

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
- [ ] В `Настройки → Абонементы` внутри активной панели нет видимого standalone-заголовка `Каталог абонементов`; сразу доступны relevant branch context, действия и operational state/list.
- [ ] В панелях `Типы групп`, `Филиалы и залы` и `Администраторы` нет видимого заголовка, повторяющего название активной вкладки.
- [ ] Названия вкладок, их active state, permission-based visibility и keyboard navigation не изменены.
- [ ] Действия `Добавить…` и `Обновить` остаются видимыми, имеют прежние accessible names и запускают прежние операции.
- [ ] Loading, empty, error, disabled, success и permission-restricted states сохранены; их собственные информативные заголовки не удалены.
- [ ] Embedded `BranchSettingsScreen` не повторяет название вкладки, а standalone-вариант сохраняет route-level заголовок `Филиалы и залы`.
- [ ] Удаление заголовков не оставляет пустых контейнеров или лишнего вертикального отступа перед первым operational block.
- [ ] На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768` и `1440 px` нет horizontal page scroll, clipping, перекрытий или недостижимых основных действий.

## Test checklist
- [ ] Обновить `SettingsScreen` component tests: для каждой разрешённой вкладки проверять отсутствие повторного видимого panel title при сохранённых tab, actions и operational states.
- [ ] Обновить `MembershipCatalogSettings`, `BranchSettingsScreen` и administrator settings tests, затронутые изменением header-контракта.
- [ ] Проверить отдельный route `BranchSettingsScreen`: standalone heading сохранён, embedded heading отсутствует.
- [ ] Добавить или обновить affected Playwright checks для всех settings-вкладок на mobile, compact-height, tablet и desktop.
- [ ] Проверить keyboard-переход между tabs, focus order и visible focus у toolbar actions.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright specs и target iPhone WebKit checks.

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
