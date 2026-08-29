# TASK-141: Качество и исполнимость agent instructions

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: refactor/TASK-141-agent-instructions-quality
- implementation_state: completed
- implementation_commit: 84d07963c946329bb8b9fbfc4693a62a50326915
- completed_at: 2026-08-29
- verification_contract: backlog/done/TASK-141-agent-instructions-quality-verification-contract.json

## Goal
Сделать repository agent instructions однозначными, компактными и
исполняемыми через verification harness без дублирования команд и скрытых
cross-layer пробелов.

## Scope
- Уточнить task terminology, requirements precedence и cross-layer routing.
- Устранить неоднозначность `--task-id` / `--task-contract`.
- Сделать harness единственным источником canonical validation commands.
- Зафиксировать Staff API contract paths и синхронизировать impact analysis.
- Сделать specialist routing результат-ориентированным и переносимым.
- Сузить impact mapping для scoped `AGENTS.md` и skills.
- Добавить автоматическую проверку repository agent instructions.
- Удалить избыточное повторение правил между root и scoped файлами.

## Out of scope
- Изменение CRM product behavior, API contracts или database schema.
- Изменение production runtime и deployment topology.
- Ослабление canonical validation baseline для project-code changes.

## Requirements
- none — developer instructions и verification tooling; поведение CRM не меняется.

## Acceptance criteria
- [x] Contract discovery использует `--task-id`; explicit path описан только как diagnostic alternative.
- [x] Staff API contract paths перечислены и выбирают frontend consumer checks.
- [x] Canonical commands определены только в harness command matrix.
- [x] Термины task/card/plan и requirements precedence однозначны.
- [x] Cross-layer routing зависит от producer/consumer impact.
- [x] UI workflow требует outcomes, но не обязательную agent topology.
- [x] Scoped instruction и skill changes выбирают пропорциональный baseline.
- [x] Agent-instruction validator проверяет routing, ссылки, command ownership и size budget.
- [x] Harness tests и diff-selected verification проходят.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: меняются только developer instructions и verification selection; CRM runtime не затрагивается.

## Validation
- Task-aware full baseline passed with an isolated npm cache.
- Agent instructions and requirements registry passed.
- Harness: 63 unit tests passed.
- Backend: format, Release build, 512 tests and NuGet vulnerability audit passed.
- Frontend: install, audit, lint, typecheck, raw-color scan, 580 unit tests and production build passed.
- Bot: locked sync, lint, format, typing and 65 tests passed.
- Deploy: both Compose configurations and deployment shell syntax passed.
