# TASK-095: Убрать остаточные дублирующие заголовки и служебные подписи

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 00:40
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-095-remove-residual-service-copy.plan.md
- implementation_branch: fix/TASK-095-remove-residual-service-copy

## Goal
Рабочие экраны CRM начинаются с полезных действий и данных без повторного названия раздела, декоративного пояснения и служебной подписи под названием организации.

## Context
В inbox приведены два видимых остатка после завершённых TASK-044 и TASK-090:

- на `Главная → Требуют внимания` показаны заголовок `Клиенты, требующие внимания` и пояснение `Повторные пропуски тренировок и вопросы по абонементам`;
- под названием организации показана подпись вида `Главный тренер • стартовый раздел: Главная`.

Исходный код подтверждает оба паттерна: section-level title/description в attention panel и `brandMeta`/`brandMetaCompact` в authenticated shell.

Новая inbox-заметка фиксирует ещё один конкретный residual block на edit route
тренера: отдельные `Редактирование доступа`, `Логин фиксируется после создания
тренера.` и hint-card `Что можно менять на этом экране`. Видимый page title с
ФИО уже однозначно называет сущность и operation context.

## User role
Все пользователи CRM.

## Problem
Дублирующая и служебная copy занимает вертикальное пространство, повторяет уже видимый навигационный контекст и отвлекает от рабочего сценария.

## Scope
- Проверить все authenticated routes на desktop и mobile на повторные route/section titles, decorative descriptions, eyebrow, intro и service labels.
- Удалить видимые заголовок и пояснение из `Главная → Требуют внимания`.
- Удалить служебную подпись с ролью и стартовым разделом под названием организации во всех вариантах authenticated shell.
- На edit route тренера удалить отдельный decorative `SectionHeader` с `Редактирование доступа` и `Логин фиксируется после создания тренера.`.
- Удалить hint-card `Что можно менять на этом экране`; сохранить связанные field labels/descriptions только там, где они меняют решение, ограничение или recovery.
- Убрать аналогичные тексты, которые только повторяют активную навигацию или не проходят `decision/usefulness test`.
- Сохранить visually hidden route `h1`, доступные имена областей и корректную heading hierarchy.
- Сохранить meaningful form titles, state/recovery messages, validation, legal/security copy и decision data.
- Обновить component и Playwright regression coverage.

## Out of scope
- Удаление названий сущностей, полей, форм, tabs, operational states или пользовательских данных.
- Удаление роли из profile menu, если она нужна пользователю в контексте аккаунта.
- Изменение стартового маршрута, navigation rules, roles или permissions.
- Backend, bot и audit contracts.

## Constraints
- Следовать разделу `Page header` в `docs/MOBILE_UI_CONTRACT.md`.
- Active persistent navigation остаётся основным видимым route context.
- Удаление текста не должно ухудшать screen-reader navigation и focus recovery.
- На экране остаются заголовки, необходимые для различения самостоятельных рабочих sections.
- Не заменять удалённую copy новыми декоративными badges или tooltips.

## Acceptance criteria
- [ ] В `Главная → Требуют внимания` не показываются указанные дублирующие заголовок и пояснение.
- [ ] Под названием организации не показываются роль, `стартовый раздел` или аналогичная служебная подпись на desktop и mobile.
- [ ] На edit route тренера не показываются `Редактирование доступа`, `Логин фиксируется после создания тренера.` и `Что можно менять на этом экране`.
- [ ] Видимый page title с ФИО, readonly login field, field labels, validation и save action сохранены.
- [ ] Все authenticated routes проверены; найденные duplicate/decorative labels удалены либо сохранены с обоснованием по `decision/usefulness test`.
- [ ] Top-level list routes не показывают название, уже видимое в persistent navigation.
- [ ] Visually hidden `h1`, region labels и heading hierarchy остаются доступными для assistive technologies.
- [ ] Form, loading, empty, error, restricted и recovery copy не удалена как декоративная.
- [ ] На обязательных mobile, compact-height, tablet и desktop размерах не остаётся пустых контейнеров или лишних отступов.

## Test checklist
- [ ] Обновить HomeDashboard/AttentionPanel component tests на отсутствие видимой duplicate copy при сохранённом accessible region name.
- [ ] Обновить shell component tests на отсутствие `brandMeta` и сохранённый profile context.
- [ ] Обновить `UserEditScreen` tests на отсутствие трёх concrete service strings при сохранённых title, fields, validation и submit.
- [ ] Обновить Playwright проверки основных routes на отсутствие route-level duplicate/service copy.
- [ ] Вручную пройти Главную, Расписание, Посещения, Клиентов, Группы, Тренеров, Журнал, Финансы и Настройки.
- [ ] Проверить 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 и 1440 px.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача удаляет конкретную frontend copy по уже утверждённому контракту, не меняя навигацию, permissions или CRM semantics.

## Clarification questions
Не требуется: пользователь указал примеры и потребовал проверить все экраны, а нормативный критерий сохранения полезной copy уже определён в `docs/MOBILE_UI_CONTRACT.md`.

## Source notes
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `Не на всех экранах в десктопной и мобильной версиях убрано дублирование заголовка экрана и пояснения... Необходимо проверить все экраны на наличие таких текстов и удалить их.`
- Original note: `Под названием организации отображается лишний служебный текст... «Главный тренер • стартовый раздел: Главная». Необходимо убрать этот текст.`
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `удалить текст «Редактирование доступа»; удалить текст «Логин фиксируется после создания тренера.»; удалить область «Что можно менять на этом экране».`

## Processing notes
- Created at: 2026-07-27 00:25
- Created by skill: codex-backlog-skill
- Duplicate check: TASK-044 и TASK-090 завершены и задали запрет на service intro/route copy; новая заметка фиксирует конкретные остатки/регрессии, поэтому создана отдельная follow-up задача вместо переоткрытия завершённых карточек.
- Updated at: 2026-07-27 01:04
- Duplicate check: trainer edit strings добавлены в существующий authenticated-route copy sweep; дублирующие return actions вынесены в TASK-097, потому что это interaction, а не copy-only scope.
