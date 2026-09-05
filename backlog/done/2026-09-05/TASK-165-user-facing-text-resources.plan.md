# Implementation Plan: TASK-165 Пользовательские тексты в layer-owned resources

## Metadata
- source_task: /backlog/done/2026-09-05/TASK-165-user-facing-text-resources.md
- completion: implemented and locally integrated into main on 2026-09-05
- requirements: REQ-NFR-007 (implements)
- branch: refactor/TASK-165-user-facing-text-resources
- readiness: yes — product owner accepted the generated inventory classifications, duplicate defaults, bounded slice decomposition and empty scanner allowlist on 05.09.2026
- dependencies: заблокирована задачами TASK-167 и TASK-168 — реализация может начаться только после того, как обе задачи реализованы и интегрированы в `main`; inventory и characterization генерируются на их интегрированном результате, чтобы их copy-изменения были поглощены, а не откачены
- risk: medium — broad cross-layer extraction can accidentally change public ProblemDetails, persisted audit descriptions, Telegram callback contracts or approved visible copy

## Goal
Дать каждому статическому текстовому сообщению, которое во frontend, backend или bot в том или ином виде отображается пользователю, явного resource-владельца независимо от языка и поставить executable gate, который запрещает новые кириллические production literals без маскировки machine-readable contracts под copy. Область миграции — весь статический user-facing copy; область автоматической детекции gate — кириллический видимый copy. Текст, вводимый пользователем, не является resource-кандидатом.

## Decisions and contracts
- Inventory охватывает все статические текстовые сообщения, которые в том или ином виде отображаются пользователю, независимо от языка, и classifies every candidate as `resource`, `backend-owned propagated text`, `dynamic user/domain value`, `machine contract`, `telemetry-only`, `test fixture` or `persisted historical description`. Only `resource` entries move; visible wording, punctuation, whitespace, line breaks, plural/count behavior, other formatting and public response fields remain byte-for-byte compatible. Изменение текста или его форматирования находится за рамками TASK-165 и требует отдельного продуктового решения.
- Frontend visible copy lives in typed feature-oriented modules under the existing resource boundary; shared text is promoted only after at least two real consumers. Frontend continues to render backend ProblemDetails meaning and does not copy backend validation semantics.
- Backend ProblemDetails titles/details, validation/display copy and new audit descriptions use domain/API-owned `.resx` plus focused typed helpers. Error/action/entity codes, routes, field names and serialized enum values remain constants. Existing persisted audit rows are untouched.
- Bot messages and button labels move to `gym_crm_bot.resources`; callback payloads, command names and protocol identifiers remain machine contracts. Backend error text is mapped or presented according to the current bot contract, not re-authored as independent CRM truth.
- Add a deterministic source scanner with a versioned narrow allowlist containing `path`, stable literal fingerprint, category, reason and owner/task. Line-number-only suppressions and blanket directory/file exclusions are forbidden. The scanner parses each language with existing toolchain syntax support where available and ignores comments/tests/generated code before classification; raw regex matches are not the enforcement contract.
- Детекция сканера ограничена кириллическими литералами, которые рендерятся как видимый UI copy — названия кнопок, пункты меню, подсказки и другой статический экранный текст. Это ограничение относится только к автоматическому gate: не-кириллический видимый copy не попадает под scanner, но обязательно входит в inventory и миграцию. Текст, вводимый пользователем, и динамические значения не классифицируются как `resource`.
- The guard fails on a newly introduced representative visible literal while accepting explicit fixtures for route/code/callback/telemetry categories. Missing required resource keys fail tests/build; production logic does not contain a hidden fallback sentence.
- Store a reviewed machine-readable inventory/allowlist and a short ownership document. If the initial inventory cannot be reviewed safely in one change-set, split migration into bounded follow-up tasks per layer/feature; TASK-165 remains unfinished until every such dependency is integrated and every identified user-facing text has been migrated. The baseline does not conceal unchecked or deferred user copy behind a broad allowlist.

## Scope
### In
- All production frontend/backend/bot static user-facing text regardless of language, resource accessors/modules, characterization tests, inventory and new-literal guard.
- Representative plural/count formatting and missing-key behavior.

### Out
- New locale/runtime language switch, copy rewriting or formatting changes, protocol identifiers, telemetry-only messages, tests/fixtures, generated sources and historical production data.
- Текст, вводимый пользователем, и динамические значения домена; не-кириллический видимый copy не входит в детекцию gate.

## Implementation slices
Review package: `/docs/USER_FACING_TEXT_RESOURCES.md`, index and literal-level
shards under `/scripts/harness/config/user-facing-text-inventory-index*`, exact
duplicate groups in `/scripts/harness/config/user-facing-text-duplicates.json`
and the proposed empty allowlist in
`/scripts/harness/config/user-facing-text-allowlist.json`. Detailed bounded
layer/feature slice IDs and ordering live in the review package; they do not
change readiness until accepted.

1. Generate the cross-layer candidate inventory and classify every finding with owner/reason. Review duplicates, propagated backend meanings and persisted audit surfaces; record bounded layer/feature slices and stop if the proposed allowlist hides unreviewed user copy.
2. Add characterization tests for representative frontend auth/settings copy, backend validation/ProblemDetails/audit display and bot message/keyboard output. Capture current exact values before extraction; these tests should be green on baseline.
3. Implement and test the scanner/allowlist contract. Confirm expected RED against known production literals such as auth validation, membership validation and bot keyboard labels, plus negative fixtures for route/error/callback/telemetry constants.
4. Extract frontend candidates into typed feature resources, preserving accessible names, formatting and component behavior. Split the current monolithic module only along observed feature ownership and update affected unit/Playwright assertions.
5. Extract backend candidates into focused `.resx` helpers without changing status codes, ProblemDetails fields/codes or audit serialization. Keep audit historical rows untouched and add exact contract coverage for each migrated family.
6. Extract bot messages/keyboards into resource modules without changing callback payloads or backend error ownership; cover dynamic interpolation, plural/count and menu navigation.
7. Re-run the language-independent inventory with zero unclassified candidates and zero user-facing resource candidates remaining outside resources, shrink temporary suppressions and wire the Cyrillic-literal guard into canonical harness entry points for all three layers. TASK-165 completes only after every bounded migration follow-up is integrated and all inventoried user-facing texts are migrated.

## Likely files and layers
- `docs/USER_FACING_TEXT_RESOURCES.md` and a machine-readable inventory/allowlist under `scripts/harness/config/` — classification, ownership and reviewed exceptions.
- `scripts/harness/commands.py`, scanner implementation and harness tests — canonical enforcement and positive/negative fixtures.
- `frontend/src/lib/resources.ts` and feature resource modules discovered by inventory — typed frontend copy ownership.
- Representative `frontend/src/app/**`, `frontend/src/features/**`, unit tests and affected Playwright specs — consumers and visible contract coverage.
- `backend/src/GymCrm.Api/**/Resources/*.resx` and typed helper classes — ProblemDetails, validation, display and new audit copy.
- Representative endpoint/validator files plus `backend/tests/GymCrm.Tests/**` — exact public contract characterization.
- `bot/src/gym_crm_bot/resources/messages.py`, `keyboards.py` and feature-specific modules — bot presentation resources.
- `bot/src/gym_crm_bot/core/**`, `telegram/**` and `bot/tests/**` — consumers and output regressions.

## Regression specification
### Automated tests to add or update
- Inventory/scanner fixtures: JSX text/accessible labels, C# ProblemDetails/validation strings and Python keyboard/message strings are rejected outside resources; route paths, enum/error codes, callback payloads, telemetry and test fixtures are accepted only under their classified rule.
- Scanner regression proves an allowlist entry fails when its literal disappears or fingerprint changes, preventing stale suppressions from becoming blanket exemptions.
- Frontend characterization covers exact auth labels/errors, one settings form with validation/recovery, one plural/count surface and accessible names before and after extraction.
- Backend contract tests cover exact status, type/code/title/detail/field errors for representative validation and ProblemDetails plus new audit-description creation; resource lookup with a missing required key fails explicitly.
- Bot tests cover exact start/access/error messages, attendance/menu keyboard labels, dynamic Telegram ID interpolation, pagination/count wording and unchanged callback data.
- Cross-layer case proves backend-owned validation detail is consumed without a separately hardcoded frontend/bot semantic copy.

### Expected red evidence
- Characterization tests are expected green before extraction because wording must not change.
- The new scanner initially fails on reviewed production literals still present outside resources (including `AuthStages.tsx`, `ClientMembershipEndpoints.cs` and bot `keyboards.py`); each approved slice removes its findings or records a narrow reviewed exception.
- Negative scanner fixtures fail if enforcement accidentally treats machine codes as user copy or allows an unclassified visible literal.

### Required validation
- Focused scanner/harness tests, representative frontend unit/Playwright, backend API/audit contract tests and bot tests for every migrated slice.
- Task verification contract must run the user-facing-literal guard across all three production trees in addition to the diff-selected layer baselines.

### Manual evidence
- Review the generated inventory and exception reasons with special attention to persisted audit descriptions, English technical-looking ProblemDetails and backend text currently surfaced by bot/frontend.
- Render representative frontend long/error/count states only where extraction changes module boundaries that could affect interpolation or accessible naming; no visual redesign is authorized.

### Regression barrier
- The primary barrier is a reviewed language-independent inventory with zero unclassified production candidates and zero user-facing resource candidates remaining outside resources, plus a repository-wide Cyrillic scanner run with zero unclassified findings and zero stale allowlist entries. Exact representative frontend/API/bot characterization tests prove that visible text, formatting and machine contracts did not change.

## Risks and stop conditions
- Stop after inventory if a candidate's owner is ambiguous, if identical wording carries different domain meanings, or if extraction would alter accepted product copy/public error semantics.
- Stop and split follow-up tasks if review cannot bound a layer/feature slice; do not merge thousands of mechanical moves or suppress the remainder wholesale. TASK-165 remains unfinished until all migration follow-ups are integrated and the complete inventory is exhausted.
- Stop if the scanner requires fragile line-number exemptions, regex-only parsing with material false positives, or broad exclusions of production directories.
- Stop before touching historical audit data, generated migrations, route/action/error codes or callback payloads; those are not resource migration targets.
- Do not start this task before TASK-167 and TASK-168 are implemented and integrated into `main`; rebase the inventory on their integrated result, absorb their resource additions and do not revert them.
