# TASK-193: Сократить повторную работу verification harness

## Status
done

## Requirements
- none — меняется инструмент проверки разработки; поведение CRM, права, данные и обязательный итоговый baseline сохраняются.

## Goal
За один итоговый прогон получить результаты независимых проверок после сбоя;
для отладки запускать выбранную проверку без ложного статуса готовности к merge.

## Scope
- Явные prerequisites в существующем последовательном runner.
- Выбор проверок по ID с prerequisites и отдельным partial report.
- Удаление повторного frontend text guard и доказанного повторного PostgreSQL
  запуска в контракте TASK-191; исторические отчёты сохраняются.
- Regression tests и документация harness. Без кеша, параллельного scheduler,
  ослабления аудитов или переиспользования результатов другого дерева кода.

## Acceptance criteria
- Ошибка не останавливает независимую проверку, зависимая получает not_run с причиной.
- Любая ошибка оставляет итоговый прогон failed; interruption останавливает весь запуск.
- Выбранная проверка запускается вместе с prerequisites; неизвестный ID отклоняется.
- Частичный прогон не принимается verification-gate, даже если все выбранные checks прошли.
- Финальный baseline сохраняет все обязательные проверки без найденных дублей.

## Source notes
- Пользователь 24.10.2026 после разбора harness: «внеси изменения с учетом замечаний и предложений».
- Приняты предложения: убрать доказанные дубли, продолжать независимые проверки,
  различать отладку и итоговую проверку; сложный кеш пока не вводить.

## Implementation lifecycle
- implementation_plan: /backlog/done/2026-10-24/TASK-193-harness-feedback.plan.md
- implementation_branch: codex/TASK-193-harness-feedback

## Completion evidence
- completed_at: 2026-10-24
- completion_date_evidence: main fast-forward до `5d4c8d809c4cd466f657dbf7f22a964b779ef033`; tree `7c1b8db63470a31f0f4a66a70722d9cfa6c76679` совпадает с проверенным candidate.
- Полный harness на чистом candidate: 23/23 checks passed, aggregate gate passed.
  Harness 118, backend 693, frontend 750 и bot 71 tests passed; dependency audits passed.
- [Итоговый отчёт](TASK-193-evidence/verification.json) и [gate](TASK-193-evidence/gate.json).
  Отчёт сохраняет исходные пути контракта и task-worktree на момент проверки.
- Red regression: прежний runner останавливал независимые checks; отсутствовали
  prerequisites/iteration, gate принимал iteration с ошибочным статусом passed.
  После изменения все regression tests прошли.
- Контракт TASK-191 теперь не повторяет PostgreSQL subset полного backend suite;
  исторические отчёты TASK-191 не менялись.
- Период проверки составил 212 секунд; это длительность итогового verification,
  а не реализации задачи. Измеренного ускорения полного цикла разработки пока нет.
