# TASK-153: Ввести visual regression gate для дизайн-системы

## Status
ready

## Requirements
- REQ-NFR-001 — verifies

## Goal
Intentional design-system changes produce reviewable deterministic visual diffs,
while accidental cross-screen and cross-theme drift fails verification.

## Context
Playwright currently provides strong behavioral and geometry coverage with
screenshots retained on failure, but the audit found no approved snapshot
baseline for core design-system states and both theme profiles.

## User role
Все пользователи CRM indirectly; developers and reviewers directly.

## Problem
Unit and behavioral tests can stay green while typography, spacing, color,
surface or component-state appearance changes unintentionally.

## Scope
- Define a small deterministic reference-state matrix for auth, shell,
  locator/list, form, modal/drawer and operational states.
- Cover both registered themes and required mobile/desktop widths.
- Store or publish diff artifacts through the existing verification harness.
- Document baseline update review rules.

## Out of scope
- Replacing behavioral assertions with screenshots.
- Snapshotting every CRM screen/state.
- Physical-device claims that automation cannot prove.

## Constraints
- Fixtures, time, animation and content must be deterministic.
- Screenshot thresholds cannot hide material text, focus or layout changes.
- Baseline changes require an explanation and rendered review.

## Acceptance criteria
- [ ] Reference matrix covers auth, shell, shared toolbar/list, form, temporary surface and key operational states.
- [ ] Required mobile and desktop widths plus both themes are represented without redundant snapshots.
- [ ] CI/harness publishes visual diff artifacts on failure.
- [ ] Baseline update procedure names reviewer evidence and prohibited shortcuts.
- [ ] Behavioral and accessibility tests remain mandatory.

## Test checklist
- [ ] Prove one expected visual failure and reviewable diff before accepting baseline.
- [ ] Run visual checks twice to demonstrate deterministic output.
- [ ] Verify focus and reduced-motion setup in relevant snapshots.
- [ ] Run the task-aware verification contract through the root harness.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: test/tooling change can create flaky CI if fixtures or rendering are not deterministic.

## Clarification questions
Не требуется.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: runtime visual quality is reviewed manually but has no reusable regression baseline.
- Related tooling: TASK-140 verification gate.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-111 provides UX audit coverage and TASK-140 runs task-aware E2E; neither owns deterministic visual baselines for design-system states.

