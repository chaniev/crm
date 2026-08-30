# Implementation Plan: TASK-165 Пользовательские тексты в layer-owned resources

## Metadata
- source_task: /backlog/risky/TASK-165-user-facing-text-resources.md
- requirements: REQ-NFR-007 (implements)
- branch: refactor/TASK-165-user-facing-text-resources
- readiness: no — сначала нужен review generated inventory, ownership classifications, slice size and scanner allowlist; mechanical extraction may proceed only after that baseline is accepted
- dependencies: заблокирована задачами TASK-167 и TASK-168 — реализация может начаться только после того, как обе задачи реализованы и интегрированы в `main`; inventory и characterization генерируются на их интегрированном результате, чтобы их copy-изменения были поглощены, а не откачены
- risk: medium — broad cross-layer extraction can accidentally change public ProblemDetails, persisted audit descriptions, Telegram callback contracts or approved visible copy

## Goal
Дать каждому статическому кириллическому user-facing тексту во frontend, backend and bot явного resource-владельца и поставить executable gate, который запрещает новые production literals без маскировки machine-readable contracts под copy. Область детекции — видимый на экранах copy: названия кнопок, пункты меню, подсказки и другой статический экранный текст. Текст, вводимый пользователем, не является resource-кандидатом.

## Decisions and contracts
- Inventory classifies every candidate as `resource`, `backend-owned propagated text`, `dynamic user/domain value`, `machine contract`, `telemetry-only`, `test fixture` or `persisted historical description`. Only `resource` entries move; visible wording, punctuation, plural/count behavior and public response fields remain byte-for-byte compatible unless an existing characterization intentionally normalizes formatting.
- Frontend visible copy lives in typed feature-oriented modules under the existing resource boundary; shared text is promoted only after at least two real consumers. Frontend continues to render backend ProblemDetails meaning and does not copy backend validation semantics.
- Backend ProblemDetails titles/details, validation/display copy and new audit descriptions use domain/API-owned `.resx` plus focused typed helpers. Error/action/entity codes, routes, field names and serialized enum values remain constants. Existing persisted audit rows are untouched.
- Bot messages and button labels move to `gym_crm_bot.resources`; callback payloads, command names and protocol identifiers remain machine contracts. Backend error text is mapped or presented according to the current bot contract, not re-authored as independent CRM truth.
- Add a deterministic source scanner with a versioned narrow allowlist containing `path`, stable literal fingerprint, category, reason and owner/task. Line-number-only suppressions and blanket directory/file exclusions are forbidden. The scanner parses each language with existing toolchain syntax support where available and ignores comments/tests/generated code before classification; raw regex matches are not the enforcement contract.
- Детекция сканера ограничена кириллическими литералами, которые рендерятся как видимый UI copy — названия кнопок, пункты меню, подсказки и другой статический экранный текст. Текст, вводимый пользователем, и динамические значения не классифицируются как `resource`. Принятый зазор: не-кириллический (английский) видимый copy не попадает под gate; при миграции он сохраняется byte-for-byte, если уже затронут срезом.
- The guard fails on a newly introduced representative visible literal while accepting explicit fixtures for route/code/callback/telemetry categories. Missing required resource keys fail tests/build; production logic does not contain a hidden fallback sentence.
- Store a reviewed machine-readable inventory/allowlist and a short ownership document. If the initial inventory cannot be reviewed safely in one change-set, this task first lands the gate and classification baseline, then creates bounded follow-up tasks per layer/feature; it does not conceal unchecked residuals behind a broad allowlist.

## Scope
### In
- Production frontend/backend/bot static user-facing text, resource accessors/modules, characterization tests, inventory and new-literal guard.
- Representative plural/count formatting and missing-key behavior.

### Out
- New locale/runtime language switch, copy rewriting, protocol identifiers, telemetry-only messages, tests/fixtures, generated sources and historical production data.
- Текст, вводимый пользователем, и динамические значения домена; не-кириллический видимый copy не входит в детекцию gate.

## Implementation slices
1. Generate the cross-layer candidate inventory and classify every finding with owner/reason. Review duplicates, propagated backend meanings and persisted audit surfaces; record bounded layer/feature slices and stop if the proposed allowlist hides unreviewed user copy.
2. Add characterization tests for representative frontend auth/settings copy, backend validation/ProblemDetails/audit display and bot message/keyboard output. Capture current exact values before extraction; these tests should be green on baseline.
3. Implement and test the scanner/allowlist contract. Confirm expected RED against known production literals such as auth validation, membership validation and bot keyboard labels, plus negative fixtures for route/error/callback/telemetry constants.
4. Extract frontend candidates into typed feature resources, preserving accessible names, formatting and component behavior. Split the current monolithic module only along observed feature ownership and update affected unit/Playwright assertions.
5. Extract backend candidates into focused `.resx` helpers without changing status codes, ProblemDetails fields/codes or audit serialization. Keep audit historical rows untouched and add exact contract coverage for each migrated family.
6. Extract bot messages/keyboards into resource modules without changing callback payloads or backend error ownership; cover dynamic interpolation, plural/count and menu navigation.
7. Re-run inventory with zero unclassified candidates, shrink temporary suppressions, wire the guard into canonical harness entry points for all three layers and publish residual/follow-up ownership if the approved slice boundary intentionally defers items.

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
- The primary barrier is a repository-wide scanner run with zero unclassified production candidates and zero stale allowlist entries, backed by exact representative frontend/API/bot characterization tests that prove visible meaning and machine contracts did not change.

## Risks and stop conditions
- Stop after inventory if a candidate's owner is ambiguous, if identical wording carries different domain meanings, or if extraction would alter accepted product copy/public error semantics.
- Stop and split follow-up tasks if review cannot bound a layer/feature slice; do not merge thousands of mechanical moves or suppress the remainder wholesale.
- Stop if the scanner requires fragile line-number exemptions, regex-only parsing with material false positives, or broad exclusions of production directories.
- Stop before touching historical audit data, generated migrations, route/action/error codes or callback payloads; those are not resource migration targets.
- Do not start this task before TASK-167 and TASK-168 are implemented and integrated into `main`; rebase the inventory on their integrated result, absorb their resource additions and do not revert them.
