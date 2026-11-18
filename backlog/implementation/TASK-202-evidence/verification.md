# TASK-202 implementation evidence

## Scope and authorization

User authorized execution on 2026-11-18: «реализуй план task-202».
Dedicated branch `codex/TASK-202-import-empty-phone-default`, based on refreshed
`origin/main` e654e25 plus coordination plan c65d70f. Readiness preflight passed
before project edits. No deployment or real client import is included.

## Regression evidence

Targeted command from repository root:

```sh
dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --configuration Release --filter 'FullyQualifiedName~ClientImportMappingTests|FullyQualifiedName~ClientXlsxReaderTests|FullyQualifiedName~ClientImportApiTests|FullyQualifiedName~ClientImportPostgreSqlTests|FullyQualifiedName~Client_create_validates_required_fields_contact_limit_and_groups'
```

- Before functional edit: 19 expected failures, 63 passed, zero skipped.
  Blank mapping/reader cases reported phone invalid_value, successful API cases
  returned 400, unsupported cells had an extra obsolete empty-phone issue,
  and failure injection could not reach persistence because validation rejected
  the blank phones first. Source profiles reproduced 47/1 and 57/9 outcomes.
- Browser red: `npm run test:e2e -- e2e/settings-client-import.spec.ts --project=chromium --grep 'SuperAdministrator: blank phones'` from frontend, using a free task-local E2E_PORT.
  Failed because rows 2/3 with blank phones incorrectly appeared as phone errors.
- After the mapping edit: the same backend selection with `--no-restore`
  passed 82/82, zero skipped, including PostgreSQL rollback at all five
  success/failure matrix entries and unchanged ordinary-create validation.
- Local diagnostics retained during execution under `.artifacts/task202-red/`
  and `.artifacts/task202-green/`; summary above is the durable red/green record.

## Review of the implemented boundary

- Functional code changes only the original-cell blank branch before splitting
  or normalizing. `NormalizePhone`, shared validation/writer, API DTOs, scope,
  transaction, reader and UI implementation are unchanged.
- Whitespace-only and absent cells default; punctuation and empty comma-separated
  components still fail. Reader formula/type errors cannot be hidden by a default.
- Tests verify actual stored numbers and ClientCreated snapshots, independent
  client IDs, existing-client preservation, assignment/audit counts, all-or-nothing
  failures, and current source profiles without altering their original data.
- Browser coverage uses two fixture scenarios per project, with different synthetic
  surnames for Chromium and each WebKit project. This avoids cross-project races
  in the shared disposable API/PostgreSQL host; it adds no product behavior.
- Existing authorization, recovery and normal client-create tests are retained.
- No new testing library, production abstraction, schema or runtime configuration.

## Final validation

Pending canonical verification on a clean committed candidate. The task contract
requires backend/frontend baselines and the import spec on Chromium plus both
existing target-iPhone WebKit projects. A physical iPhone/Simulator and real
Safari browser chrome/keyboard were not tested; no UI implementation changes.
