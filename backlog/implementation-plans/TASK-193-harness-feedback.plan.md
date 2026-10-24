# Implementation Plan: TASK-193 Harness feedback

## Metadata
- source_task: /backlog/implementation/TASK-193-harness-feedback.md
- branch: codex/TASK-193-harness-feedback
- readiness: yes
- requirements: none — инструмент разработки; CRM behavior и обязательный финальный baseline не меняются
- product_decisions: none — продуктовые правила не меняются
- technical_decisions: none — локальное расширение существующих CheckSpec, runner и gate в пределах прямого запроса
- architecture_decisions: none — нет нового scheduler, кеша, сервиса или смены границ ответственности
- open_questions: none
- dependencies: интегрированная main 59765b7 с TASK-191 и актуальными skills
- risk: medium — частичный или заблокированный запуск не должен выдать passed

## Goal
Сократить повторные циклы проверки при сохранении строгого итогового gate.

## Decision evidence
- [Запрос и границы](/backlog/implementation/TASK-193-harness-feedback.md) фиксируют разрешённую техническую доработку без изменения продукта.

## Decisions and contracts
- Сохраняется последовательный runner. CheckSpec получает prerequisites; проверка
  запускается только после их успеха. Неизвестные/повторные/поздние зависимости
  отклоняются до запуска; arbitrary runtime smoke консервативно зависит от
  всего canonical baseline, Playwright — от установки frontend и browsers.
- После обычной ошибки/timeout продолжаются независимые проверки. Отсутствие
  prerequisite → not_run + blocked_by; interruption → остановка и exit 130.
- Повторяемый --check выбирает существующие ID и их prerequisites. Такой запуск
  всегда iteration/partial, не даёт merge evidence и использует отдельный default
  report. Успешная отладка возвращает exit 0; ошибки — nonzero. CI не разрешает --check.
- Итоговый режим остаётся default; manual requirements сохраняются. Partial report
  не подтверждает manual checks и отвергается aggregate gate.
- Удаляется frontend.user-facing-text: тот же guard остаётся в frontend.check.
  Из TASK-191 contract удаляется повторный --filter PostgreSQL suite, который
  уже входит в backend.test с теми же параметрами; старые evidence не переписываются.

## Implementation slices
1. Red tests: independent/dependent failure, interruption, iteration prerequisites
   и отказ gate; checks matrix/contract dependency validation.
2. Расширить commands.py, task_contract.py, verify_change.py и aggregate_evidence.py;
   убрать два конкретных дубля без общего механизма inference или кеша.
3. Обновить docs/HARNESS.md и инструкцию executor, проверить полный harness и CI path.

## Regression specification
- Python unittest с реальными короткими subprocess проверяет исполнение и коды выхода;
  CLI tests подтверждают partial marker, неизвестные ID и отдельный report.
- Gate tests отвергают iteration, включая ошибочно помеченный passed report.
- Expected red: текущий runner прекращает независимый запуск и не поддерживает --check.
- Полный diff-selected baseline обязателен для изменения execution core; task contract
  не добавляет повторный harness suite. Ручных продуктовых проверок нет.
