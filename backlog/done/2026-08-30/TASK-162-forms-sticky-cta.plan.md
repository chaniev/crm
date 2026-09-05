# Implementation Plan: TASK-162 Sticky primary CTA форм на мобильных

## Metadata
- source_task: /backlog/done/2026-08-30/TASK-162-forms-sticky-cta.md
- completion: implemented and locally integrated into main on 2026-08-30
- requirements: REQ-NFR-001 (constrains)
- branch: feature/TASK-162-forms-sticky-cta
- readiness: yes
- dependencies: none; использует существующие `TemporarySurfaceFooter` и `--crm-layer-sticky-action-bar`; координировать с TASK-161 (drawer/bottom-sheet рецепт), если оба в работе
- risk: medium — затрагивает 9 форм-экранов, но изменение presentation-раскладки действия при сохранении сабмит-контрактов

## Goal
На `390/420px` primary CTA всех мобильных форм (клиент, группа, тренер, занятие, series edit) виден в sticky-полосе без скролла, не перекрыт keyboard/nav; secondary action доступен; desktop `> 48rem` сохраняет действие в top-bar.

## Decisions and contracts
- Один shared-паттерн sticky form action bar (новый shared-компонент): primary на всю ширину или доминантную часть, secondary рядом, safe-area + bottom-nav offset, слой `--crm-layer-sticky-action-bar`; один visually dominant primary на активное состояние формы; высота кнопки ≥ 44px.
- Мобильные формы применяют паттерн механически, без per-form fork; drawer-формы расписания, уже использующие `TemporarySurfaceFooter`, выравниваются на общий контракт вместо дублирования.
- Поведение сабмита, валидации, duplicate-submit protection, ProblemDetails mapping и focus-поведение не меняются.
- Критерий при открытой софт-клавиатуре: primary action остаётся видимым или достижимым одним скроллом.
- Без новой глобальной state-машины; Mantine/shared-компоненты.

## Scope
### In
- Shared sticky form action bar; применение к клиент (create/edit), группа (create/edit), тренер (create/edit), занятие (create/edit/move) и series edit; regression-покрытие.

### Out
- Перекомпоновка полей форм; операции/permissions/валидация; detail-экраны без форм.

## Implementation slices
1. RED: browser-ассерты «primary CTA виден без скролла на 390/420» на затронутых формах (падают при текущей текстовой кнопке в top-bar).
2. Ввести shared-компонент sticky action bar с component-тестами (layering, safe-area, dominance, disabled/pending state).
3. Применить паттерн к формам клиента и группы; прогнать их form-флоу (сабмит, ошибки валидации, duplicate-submit).
4. Применить к формам тренера и занятия (create/edit/move, series edit), включая выравнивание drawer-форм на общий контракт; compact-height smoke `912 x 420`/`956 x 440` и target-iPhone прогон.

## Likely files and layers
- `frontend/src/features/shared/` — новый sticky form action bar (+ test), рядом с `TemporarySurfaceFooter.tsx`.
- `frontend/src/features/clients/ClientForm.tsx`, `ClientCreateScreen.tsx`, `ClientEditScreen.tsx`.
- `frontend/src/features/groups/GroupForm.tsx`, `GroupCreateScreen.tsx`, `GroupEditScreen.tsx`.
- `frontend/src/features/users/UserCreateScreen.tsx`, `UserEditScreen.tsx`, `UserFormFields.tsx`.
- `frontend/src/features/schedule/ScheduleOneOffCreateDrawer.tsx`, `ScheduleLessonChangeDrawer.tsx` — выравнивание на общий контракт.
- Затронутые e2e form-флоу (clients/groups/users/schedule) + `frontend/e2e/iphone-target-devices.spec.ts`.

## Regression specification
### Automated tests to add or update
- Component: sticky bar — primary dominant, secondary доступен, layer/safe-area классы, disabled/pending состояние отражает форму.
- Browser mobile: на `390/420` primary CTA виден без скролла, не перекрыт bottom nav; secondary достижим; desktop `> 48rem` — действие в top-bar.
- Существующие form-флоу assertions (сабмит, ошибки валидации, duplicate-submit, focus) остаются зелёными во всех затронутых спецификациях.
- Compact-height smoke + `npm run test:e2e:iphone`.

### Expected red evidence
- Новые mobile-visibility ассерты падают, пока primary CTA — текстовая кнопка в правом верхнем углу.

### Required validation
- Root verification harness для frontend diff; affected Chromium form flows; `npm run test:e2e:iphone`.

### Manual evidence
- Поведение при реальной софт-клавиатуре (visualViewport) проверяется на стенде; физическая клавиатура/Safari — записать как непроверенное.

### Regression barrier
- Один form-flow сценарий (create клиента) на target-iPhone: sticky CTA виден, форма сабмитится, ошибка валидации отображается, повторный сабмит заблокирован.

## Risks and stop conditions
- Если конкретная форма не может принять shared-бар без перекомпоновки полей — остановиться на этой форме и зафиксировать; не форсировать layout-изменения полей (out of scope).
- Не менять duplicate-submit/validation логику ради видимости кнопки; конфликт — стоп и запись в задаче.

## Implementation result
- Slices 1–4 выполнены: RED component evidence зафиксирован, shared-компонент
  добавлен в production inventory/catalog и применён ко всем формам scope.
- Desktop сохраняет существующее расположение действия в конце формы; mobile
  route использует fixed thumb-zone над nav, mobile drawer — sticky footer.
- Проверки: frontend check 646/646, Chromium group create, WebKit target iPhone
  4/4, audit 0, registry/instructions validators pass.
- Остаточная ручная проверка: физический Safari с открытой soft-клавиатурой.
