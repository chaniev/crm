# TASK-107: Уплотнить мобильный журнал и исправить pagination/focus

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-02 16:53
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-107-audit-log-mobile-density-focus.plan.md
- implementation_branch: fix/TASK-107-audit-log-mobile-density-focus
- implementation_state: completed
- implementation_commit: e89802c
- delivered_on_main_at: 2026-08-22
- moved_to_done_at: 2026-08-22
- last_status_reviewed_at: 2026-08-22

## Goal
Пользователь быстрее сканирует журнал на мобильном устройстве, безопасно переключает страницы и всегда возвращается к исходной записи после закрытия деталей.

## Context
На `440 x 956` одна audit-запись занимает около `200px` из-за повторяющихся labels `Дата / Описание / Пользователь`. Pagination controls измерены как `32 x 32px`, previous/next не имеют accessible name, а details modal отключает встроенный return focus и восстанавливает его через delayed timeout. TASK-099 удалил отдельную колонку `Действие`, но явно оставил pagination вне scope.

## User role
SuperAdministrator / HeadCoach / Administrator с backend-разрешённым доступом к журналу.

## Problem
Избыточная высота строк снижает scan density, маленькая пагинация повышает риск ошибочного нажатия, а недетерминированный focus return нарушает keyboard recovery.

## Scope
- Перестроить mobile row в compact metadata hierarchy без повторения очевидных labels.
- Сохранить actor, action/description, entity/context и date доступными без открытия details.
- Увеличить hit area всех pagination controls до `44 x 44px` и задать previous/next стабильные accessible names.
- Вернуть встроенный или иной детерминированный modal focus return без delayed timeout.
- Определить осознанный UI fallback для технических/англоязычных backend descriptions без изменения audit payload.
- Обновить component и Playwright regression coverage.

## Out of scope
- Изменение audit persistence, event semantics, permissions, фильтров или backend response.
- Удаление диагностических данных из details modal.
- Локальный перевод неизвестных action types с риском искажения смысла.

## Constraints
- Backend остаётся source of truth для audit records и access scope.
- Compact row не скрывает actor/action/entity/date и не передаёт смысл только цветом.
- Escape, overlay close и explicit close возвращают focus в trigger записи, если trigger остаётся в DOM.
- Pagination сохраняет текущую страницу, фильтры и корректное disabled state.
- На `390/420/440px` не появляется horizontal overflow.

## Acceptance criteria
- [x] Actor, action/description, entity/context и date читаются без открытия details.
- [x] Mobile row не повторяет labels, уже понятные из устойчивой структуры, и показывает больше одной записи в типичном viewport `440 x 956`.
- [x] Все pagination controls имеют hit area не меньше `44 x 44px`.
- [x] Previous/next имеют стабильные accessible names и корректные disabled semantics.
- [x] Escape, overlay close и explicit close детерминированно возвращают focus в trigger.
- [x] Технический fallback не смешивает русский и английский текст случайным образом и не меняет backend semantics.
- [x] Loading, empty, filtered-empty, error, retry и stale states сохраняют фильтры и понятный recovery.

## Test checklist
- [x] Добавить component tests для compact row hierarchy и technical description fallback.
- [x] Добавить geometry/accessibility assertions для pagination на `390/420/440px`.
- [x] Добавить focus-return cases для Escape, overlay и explicit close без timer dependency.
- [x] Проверить keyboard order, screen-reader names и disabled pagination.
- [x] Проверить long actor/entity/description и отсутствие horizontal overflow.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: изменения ограничены frontend-представлением и interaction accessibility; audit data, semantics и permissions остаются неизменными.

## Clarification questions
Не требуется: обязательные поля, размеры и focus behavior заданы; fallback не должен интерпретировать неизвестную backend-семантику.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-06 — уплотнить журнал и исправить pagination/focus`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-audit-440x956.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-099 прямо исключала pagination и не исправляла обнаруженную row-density/focus проблему.
- Grouping: density, pagination и details focus объединены как один mobile audit-log workflow.

## Completion record
- Completed on: 2026-08-22.
- Implementation commit: `e89802c`; integrated into local `main` by fast-forward.
- Test-first evidence: до production-кода mobile row измерялся около `199.7px`, pagination — `32 x 32px`; отсутствовали accessible pager names, deterministic focus-return и разделённые empty/retry/stale barriers.
- Integrated validation: frontend lint, production build, 468 unit tests, raw-color scan with 0 disallowed findings, 96 affected Chromium Playwright tests and 38 target-iPhone WebKit tests passed.
- Backend/API/database contracts were not changed; migration is not required.
- No Docker Compose task stack was created because the plan required frontend component and mocked browser validation only.
- Residual device risk: physical Safari chrome, actual safe-area/home-indicator behavior, iOS Simulator and physical-device touch were not verified; target-iPhone WebKit portrait and compact-landscape profiles passed.
