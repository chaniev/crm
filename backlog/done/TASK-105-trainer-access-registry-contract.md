# TASK-105: Довести реестр тренеров до access-management workflow

## Status
done

## Goal
HeadCoach или SuperAdministrator быстро находит тренера с исключительным
состоянием доступа и открывает разрешённое редактирование через однозначный
trainer-only workflow с каноническим route/API path `/coaches`.

## Context
После TASK-096 реестр поддерживает локальный поиск по ФИО и логину. После
TASK-098 обычные positive badges намеренно скрыты, а decision-changing
исключения сохранены. Аудит 2026-08-02 предложил role/active/password/Telegram
filters и более лёгкую row operation.

Продуктовое уточнение 2026-08-19 сохраняет экран trainer-only, принимает
рекомендованные фильтры только по отключённым тренерам и обязательной смене
пароля, не считает отсутствие Telegram самостоятельным исключением и делает
строку primary edit target. Технический `/users` должен быть переименован в
`/coaches` во frontend routes и backend trainer-management API.

Текущий backend уже возвращает из trainer endpoint только `Coach`, отдельно
управляет `Administrator`/`SuperAdministrator` через
`/settings/administrators`, разрешает trainer management только `HeadCoach` и
`SuperAdministrator` и передаёт per-row `allowedActions`. Эти access semantics
не меняются.

## Product decisions
- Экран и endpoint остаются trainer-only; другие staff roles не добавляются.
- Канонические frontend routes и backend API routes:
  `/coaches`, `/coaches/new`, `/coaches/{id}/edit` и trainer CRUD API под
  `/coaches` вместо `/users`.
- Старый `/users` не остаётся параллельным frontend/API alias.
- Управляющие роли: `HeadCoach` и `SuperAdministrator`; `Administrator` и
  `Coach` не получают доступ.
- Фильтры выполняются локально только над backend-permitted response:
  `Статус: Все / Отключённые` и
  `Пароль: Все / Требуется смена`.
- Между search и выбранными filter dimensions применяется `AND`; reset filters
  не очищает search query.
- Role filter не выводится, потому что canonical response содержит только
  `Coach`.
- Telegram ID показывается только при наличии. Отсутствие Telegram не получает
  badge и не добавляется в фильтры.
- Editable row целиком является единственным primary edit target. На mobile
  отдельная тяжёлая кнопка `Редактировать` отсутствует; на desktop trailing
  `Редактировать` является только частью одного row target, а не вторым
  focusable action.
- Read-only row остаётся статичной и показывает `Только просмотр`; editability
  определяется только backend `allowedActions`.

## User role
HeadCoach / SuperAdministrator.

## Problem
Текущий список хорошо ищет identity, но не позволяет быстро отобрать два
decision-changing access exception и повторяет тяжёлую кнопку редактирования в
каждой строке. Путь `/users` также противоречит уже принятой trainer-only
семантике раздела и отдельному управлению администраторами.

## Scope
- Переименовать backend trainer CRUD contract с `/users` на `/coaches`, включая
  list, details, create и update endpoints.
- Переименовать frontend trainer routes и deep links с `/users...` на
  `/coaches...`; обновить API consumer, navigation active state, back/forward,
  reload и permission recovery.
- Не сохранять старый `/users` как второй backend или frontend route.
- Сохранить backend-owned trainer-only response и существующую access matrix.
- Добавить filter trigger в существующий `EntityLocatorBar` и локальные
  фильтры `Отключённые` и `Требуется смена пароля`.
- Показывать active filter count/state и предсказуемый reset без очистки search.
- Сохранять search и filter state при refresh, stale error и переходе
  list -> edit -> back в пределах trainer workflow.
- Сохранить row metadata: ФИО, логин, optional Telegram ID, `Отключен`,
  `Требуется смена пароля` и defensive `Только просмотр`.
- Сделать editable row одним интерактивным edit target; убрать отдельную
  тяжёлую mobile-кнопку `Редактировать`.
- Обновить все backend/frontend contract, component, integration и Playwright
  consumers и regression tests.

## Out of scope
- Единый staff/access registry и перенос администраторов из настроек.
- Доступ `Administrator` или `Coach` к управлению тренерами.
- Изменение ролей, permissions, password policy, Telegram linking semantics или
  backend `allowedActions` matrix.
- Возврат обычных меток `Тренер`, `Активен` и `Пароль актуален`, удалённых TASK-098.
- Role filter, Telegram filter и badge отсутствующего Telegram.
- Server-side filtering, paging или новый query contract.
- Переименование общей domain/database модели `User`, auth/audit terminology,
  `canManageUsers`, `AppSection.Users` или generic DTOs только ради косметической
  согласованности.
- Изменение `/settings/administrators`.

## Constraints
- Backend владеет roles, permissions, visible staff scope, password state,
  Telegram identity и `allowedActions`.
- Frontend не должен выводить доступ или разрешённые действия из названия роли.
- Editable row существует только при `allowedActions` с `Edit` или `Update`;
  пустой или отсутствующий action set не должен открывать mutation flow.
- Normal/default states не конкурируют с исключительными состояниями; статус показывается текстом, а не только цветом.
- Search, filter trigger, refresh и create остаются в одной non-wrapping строке
  на `390/420/440px`, сохраняют полезную ширину поиска и touch targets
  `44 x 44px`.
- Backend route rename и обновление всех consumers должны доставляться атомарно;
  нельзя оставить frontend, tests или CSRF coverage на старом `/users`.
- Не переименовывать общую `User` model: она также представляет
  административные и auth accounts.

## Acceptance criteria
- [ ] `/coaches` является единственным backend trainer CRUD route; старый
  `/users` не обслуживает trainer requests.
- [ ] Frontend list/create/edit routes используют `/coaches...`; navigation,
  direct deep link, reload, back/forward и permission redirect работают на
  новых путях без параллельного `/users` route.
- [ ] Backend `/coaches` возвращает только `Coach`; доступ остаётся у
  `HeadCoach` и `SuperAdministrator`, а `Administrator` и `Coach` получают
  прежний deterministic forbidden contract.
- [ ] Доступны локальные filters `Отключённые` и `Требуется смена пароля`;
  search и dimensions комбинируются через `AND`, active state видим, reset
  предсказуем и не очищает query.
- [ ] Role/Telegram filters отсутствуют; отсутствие Telegram не показано как
  exception, а существующий Telegram ID остаётся видимым.
- [ ] `Тренер`, `Активен` и `Пароль актуален` не возвращены; `Отключен` и
  `Требуется смена пароля` остаются текстовыми exceptions.
- [ ] Editable row является одним keyboard/touch edit target с backend-owned
  permission; read-only row не интерактивна и показывает `Только просмотр`.
- [ ] На mobile нет отдельной тяжёлой кнопки `Редактировать`; desktop cue не
  создаёт второй tab stop или вторую операцию.
- [ ] Search, filter, refresh и create находятся в одной строке без horizontal
  page scroll на обязательных viewport sizes.

## Test checklist
- [ ] Backend integration: `HeadCoach` и `SuperAdministrator` list/create/update
  через `/coaches`; `Administrator` и `Coach` получают прежний 403; response
  содержит только `Coach` и backend-owned actions.
- [ ] Backend contract: старый `/users` не mapped; CSRF, validation,
  ProblemDetails и audit semantics сохранены на `/coaches`.
- [ ] Frontend route/API integration: list/create/edit, direct deep link,
  reload, explicit/browser back и permission redirect используют `/coaches`.
- [ ] Component: оба filters отдельно и вместе, search + filters, active count,
  reset, empty-filtered state, refresh/stale-error recovery и retained state.
- [ ] Component: normal, inactive, password-rotation, combined, Telegram-present
  и read-only rows; отсутствуют default badges и missing-Telegram marker.
- [ ] Keyboard/touch: editable row имеет один tab stop и Enter/Space path;
  read-only row статична; focus возвращается после edit/back.
- [ ] Toolbar и строки: `360`, `390 x 844`, `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440`, `768` и `1440 x 1200`; no horizontal page scroll,
  clipping или недостижимые controls.
- [ ] Запустить backend tests, frontend unit/lint/build, affected Playwright и
  target-iPhone WebKit checks.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача атомарно меняет защищённый staff-management HTTP/route contract
  и все его consumers. Permission semantics остаются прежними, но rename должен
  быть доказан authorization, CSRF, ProblemDetails и cross-layer regression
  tests без временного параллельного endpoint.

## Clarification questions
Не требуются: scope, access matrix, canonical paths, filters, Telegram treatment,
row operation и client-side filtering подтверждены пользователем 2026-08-19.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-04 — довести реестр тренеров до access-management сценария`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-users-440x956.png`.
- User clarification, 2026-08-19: экран остаётся только для тренеров;
  `/users` нужно изменить на `/coaches`; filters, Telegram treatment и row
  operation принимаются согласно рекомендованному trainer-only контракту.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Updated at: 2026-08-19 22:54 after direct product clarification.
- Duplicate check: активного дубликата нет. Завершённый TASK-029 сознательно
  оставлял technical `/users` неизменным и поэтому является baseline, а не
  дубликатом; TASK-096 и TASK-098 остаются обязательными search/row baselines.
- Classification: moved from `needs-clarification` to `risky`; обязательные
  вопросы закрыты, но `/users` -> `/coaches` меняет защищённый cross-layer API
  and route contract. Backend и frontend части не разделяются, потому что
  atomic contract rename обязан обновить всех consumers в одной поставке.
