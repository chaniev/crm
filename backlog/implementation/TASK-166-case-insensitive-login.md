# TASK-166: Сделать вход по логину регистронезависимым

## Status
implementation

## Requirements
- REQ-USR-002 — changes
- REQ-USR-003 — changes
- REQ-NFR-003 — constrains

## Goal
Сотрудник успешно входит с правильным логином и паролем независимо от регистра
букв в введённом логине, при этом CRM сохраняет одну однозначную учётную запись
и отображает её канонический сохранённый логин.

## Context
Текущий `/auth/login` обрезает пробелы и ищет пользователя точным сравнением
`candidate.Login == login`. Уникальный индекс и create/bootstrap validation
также не фиксируют регистронезависимую identity semantics, поэтому простая
замена login query может сделать записи вроде `Coach` и `coach` неоднозначными.

## User role
Все сотрудники с учётной записью CRM.

## Problem
Пользователь получает отказ во входе, если вводит правильный логин в другом
регистре; небезопасная локальная правка lookup может создать конфликт identity
для уже сохранённых или новых логинов.

## Scope
- Определить единый backend normalization/comparison contract для login identity.
- Сделать authentication lookup регистронезависимым с сохранением канонического
  stored login в session, audit и UI.
- Обеспечить регистронезависимую уникальность при create/bootstrap/seed и на
  уровне PostgreSQL persistence barrier.
- Добавить retained-database preflight/upgrade path для возможных case-collisions.
- Покрыть login, create/update prohibition, bootstrap и collision scenarios.

## Out of scope
- Регистронезависимый пароль или изменение password hashing.
- Разрешение смены логина после создания.
- Автоматическое объединение, удаление или переименование конфликтующих
  production accounts.
- Изменение ролей, permissions, sessions или audit semantics вне canonical login.

## Constraints
- При обнаружении `Coach`/`coach` upgrade останавливается с явной диагностикой;
  записи нельзя молча объединять или выбирать произвольно.
- Authentication errors не раскрывают существование конкретного логина.
- Backend остаётся единственным владельцем identity comparison; frontend не
  нормализует логин как security decision.
- Clean bootstrap и каждый retained-database upgrade path должны быть проверены.

## Acceptance criteria
- [ ] Существующая учётная запись входит при любом регистре букв логина и правильном пароле.
- [ ] Неверный пароль и неизвестный логин возвращают прежний нераскрывающий credentials contract.
- [ ] Нельзя создать или bootstrap-нуть логин, отличающийся от существующего только регистром.
- [ ] При обычном или конкурентном создании case-only дубля пользователь получает одинаковую field-level ошибку у поля `login`: «Пользователь с таким логином уже существует.».
- [ ] Session, audit и UI используют канонический сохранённый логин, а не введённый вариант.
- [ ] Retained database с case-collision не обновляется неоднозначно и выдаёт actionable stop evidence.
- [ ] PostgreSQL и test provider coverage фиксируют одинаковую identity semantics.

## Test checklist
- [ ] Добавить AuthFlow cases для lower/upper/mixed-case login.
- [ ] Добавить create/bootstrap validation cases для case-only duplicate.
- [ ] Проверить одинаковую field-level ошибку `login` для обычного и конкурентного case-only duplicate.
- [ ] Добавить PostgreSQL uniqueness и retained-database collision tests.
- [ ] Запустить backend format, Release build, dependency audit и полный xUnit suite.
- [ ] Проверить login UI smoke без frontend-owned normalization.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: задача меняет authentication identity, unique persistence contract и retained-database upgrade behavior.

## Clarification questions
Не требуется: case-insensitive identity принята; любые существующие collisions
являются stop condition и требуют отдельного решения по конкретным данным.

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `логин пользователя при авторизации сделать регистро не зависимым`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: active and done tasks cover roles, user forms and auth UI but no task owns case-insensitive login identity or its persistence collision barrier.
- Classification: risky because authentication and a case-insensitive unique database invariant must change together.
- Product clarification: 2026-09-01 — пользователь должен видеть field-level сообщение «Пользователь с таким логином уже существует.» и при обычном, и при конкурентном case-only duplicate; login authentication остаётся non-enumerating.
- Implementation start: 2026-09-01 — пользователь явно запросил реализацию плана; data/security review зафиксирован в ADR-0001, stop conditions — в плане; карточка переведена в `implementation`.
