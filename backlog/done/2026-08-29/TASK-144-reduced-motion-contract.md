# TASK-144: Добавить reduced-motion contract

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-29/TASK-144-reduced-motion-contract.plan.md
- implementation_branch: feature/TASK-144-reduced-motion-contract
- integrated_to_main_at: 2026-08-29
- candidate_commit: 6f64b7b27c71440640a287db1f137a36eb82b617

## Requirements
- REQ-NFR-001 — changes

## Goal
Пользовательская настройка `prefers-reduced-motion` уменьшает или отключает
необязательные animations, сохраняя понятную обратную связь и доступность CRM.

## Context
Проект содержит custom transitions и бесконечный skeleton pulse, но audit не
нашёл общей motion scale или `prefers-reduced-motion` override.

## User role
Пользователи с vestibular/motion sensitivity; все пользователи частых CRM workflows.

## Problem
Кастомные animations не подчиняются системному предпочтению пользователя, а
durations/easing задаются локально и могут расходиться.

## Scope
- Define minimal duration/easing tokens for functional transitions.
- Add reduced-motion policy for custom skeletons, navigation, filters,
  temporary surfaces and notifications.
- Keep required progress and completion feedback visible without relying on motion.

## Out of scope
- Decorative animation redesign.
- Changing Mantine library internals.
- Workflow or navigation changes.

## Constraints
- Frequent navigation and keyboard-first actions remain effectively instant.
- Motion cannot be the only signal of state change.
- Preserve focus, Escape, focus-return and safe-area behavior.

## Acceptance criteria
- [ ] Common duration and easing tokens are documented and used by custom CSS.
- [ ] `prefers-reduced-motion: reduce` disables continuous/nonessential animation.
- [ ] Loading, pending and completion remain distinguishable in reduced mode.
- [ ] No layout shift is introduced when animation is disabled.
- [ ] A regression test exercises reduced-motion rendering.

## Test checklist
- [ ] Add CSS/unit checks for motion tokens and reduced override.
- [ ] Add Playwright emulation for one skeleton and one temporary surface.
- [ ] Verify keyboard/focus behavior with reduced motion enabled.
- [ ] Run root frontend verification through the harness.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: bounded accessibility behavior with no CRM domain or contract changes.

## Clarification questions
Не требуется.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: motion tokens and reduced-motion support are absent.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-084 covers compact-height/touch behavior, not reduced motion; no active duplicate found.
