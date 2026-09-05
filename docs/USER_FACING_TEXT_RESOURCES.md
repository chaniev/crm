# TASK-165 user-facing text inventory review

## Review state

- Baseline: `proposed`; it is not accepted and does not authorize extraction.
- Source tree: `dfe9501775ba9e7ffdb4cf320b585ff82aabb72d` (`origin/main` after
  TASK-167 and TASK-168 integration).
- Inventory index:
  `scripts/harness/config/user-facing-text-inventory-index.json`.
- Literal-level shards:
  `scripts/harness/config/user-facing-text-inventory-index/*.json`.
- Duplicate review:
  `scripts/harness/config/user-facing-text-duplicates.json`.
- Proposed scanner allowlist:
  `scripts/harness/config/user-facing-text-allowlist.json`.

The inventory deliberately over-classifies ambiguous static strings as
`resource`. Review may reclassify an entry only with a concrete owner and
reason. A reviewer must not move unresolved visible copy into the allowlist.

## Baseline result

The generator recorded 2,760 unique path/fingerprint/category entries and
3,159 occurrences. Existing resources account for 432 entries. Outside that
boundary it found 1,961 Cyrillic and 183 non-Cyrillic `resource` candidate
occurrences. The inventory also records 178 classified Cyrillic exception
candidates: 123 component-catalog/test fixtures and 55 seeded domain values.

The proposed allowlist is empty. Known fixtures, seeded domain values,
machine contracts and telemetry must be recognized from syntax and source
context by the later scanner. An entry may be added to the allowlist only if
syntax-aware classification cannot remove a demonstrated false positive. Its
identity is exact path plus the SHA-256 fingerprint of the decoded literal;
line numbers are review hints, never suppression identity.

There are 191 exact-text duplicate groups crossing proposed owners. Identical
wording is not sufficient to make a shared resource. The default decision in
the duplicate report is to retain feature ownership until review proves that
at least two real consumers share one meaning.

No source literal is classified as `persisted historical description`:
historical audit descriptions exist as database values rather than source
copy and remain untouched. `backend-owned propagated text` likewise has no
static literal entry: frontend and bot currently receive those values at
runtime. Characterization must prove that consumers render or map the backend
meaning without introducing a second static semantic copy.

## Ownership categories

| Category | Owner and action |
|---|---|
| `resource` | Owning frontend feature module, backend API/domain `.resx` helper, or `gym_crm_bot.resources`; characterize exactly, then move. |
| `backend-owned propagated text` | Backend owns the meaning; frontend/bot only render or contractually map it. Never duplicate the validation rule. |
| `dynamic user/domain value` | Entity/configuration data such as seeded names; do not localize as presentation copy. |
| `machine contract` | Route, field, error/action code, enum, callback payload, command, resource key, or protocol identifier; keep constant. |
| `telemetry-only` | Operational diagnostic not rendered to a user; keep outside presentation resources. |
| `test fixture` | Test or separately built component-catalog fixture; scanner recognizes the non-production source context. |
| `persisted historical description` | Existing stored audit text; never rewrite as part of TASK-165. |

Frontend resources remain typed and feature-oriented. Shared promotion requires
two demonstrated consumers. Backend visible ProblemDetails, validation,
display and new audit descriptions use focused `.resx` helpers. Bot messages
and labels live in `gym_crm_bot.resources`, while callback data and commands
remain machine contracts.

## Layer and feature slices

Counts below are conservative `resource` candidates; `entries` group equal
literals within one file, while `occurrences` preserve repeated use.

| Slice | Entries | Occurrences | Boundary |
|---|---:|---:|---|
| FE-1 app shell/auth | 103 | 110 | `App`, auth stages, route viewport and bootstrap loading copy |
| FE-2 schedule core | 161 | 194 | schedule grid, labels, reasons and presentation helpers |
| FE-3 schedule mutations | 99 | 116 | change/create/cancel drawers and deferred action surfaces |
| FE-4 attendance | 70 | 75 | attendance worklist, roster controls, progress and save state |
| FE-5 client list | 102 | 122 | filters, toolbar, rows, preview and list view-model copy |
| FE-6 client profile | 196 | 206 | client form, detail, overview, history and transfer surfaces |
| FE-7 client membership | 138 | 143 | purchase, renewal, correction, transfer, history and pricing |
| FE-8 client messenger/media | 64 | 71 | messenger chat, photo and note attribution surfaces |
| FE-9 attention | 40 | 50 | attention dashboard and operational panel |
| FE-10 settings/branches | 106 | 113 | settings shell and branch configuration |
| FE-11 settings/users | 103 | 108 | administrators, attendance scope and user screens |
| FE-12 settings/membership | 32 | 34 | membership catalog settings; shares a terminology review dependency with FE-7, not automatically a shared resource |
| FE-13 groups core | 120 | 132 | group list/create/edit/form and client rows |
| FE-14 group staffing | 60 | 61 | trainer assignments and substitutions |
| FE-15 finance | 69 | 93 | report filters, scope and presentation |
| FE-16 audit | 58 | 72 | audit filters, action/entity/source presentation |
| FE-17 shared/routing/theme | 124 | 128 | shared UX, navigation, API fallback presentation and global accessible labels |
| BE-1 auth/users/access | 0 | 0 | reviewed current literals are resource keys or machine contracts |
| BE-2 clients | 30 | 37 | client validation, response display and messenger surfaces |
| BE-3 client membership | 27 | 31 | membership validation and ProblemDetails families |
| BE-4 attendance | 8 | 9 | attendance validation and ProblemDetails |
| BE-5 groups | 50 | 55 | groups, group types, trainers and assignment validation |
| BE-6 schedule | 62 | 80 | schedule/series validation and ProblemDetails |
| BE-7 bot internal API | 13 | 18 | exact internal ProblemDetails contract consumed by bot |
| BE-8 startup/reports/audit | 3 | 3 | remaining visible startup/API surfaces |
| BOT-1 service/access | 8 | 8 | start, access, unsupported-command and menu prompts |
| BOT-2 attendance | 28 | 29 | date/group/roster prompts, summaries and warnings |
| BOT-3 clients/rendering | 45 | 46 | client search, cards, membership and formatting labels |

FE-12 is not extracted until duplicate review decides whether catalog
terminology and client-membership terminology are the same meaning.

## Recommended implementation decomposition

Each implementation slice starts with exact characterization and ends with its
focused tests. No slice may change wording, punctuation, whitespace, line
breaks, interpolation, plural/count behavior, public fields, callback data or
codes.

1. **Gate infrastructure:** replace the baseline C# lexical collector with
   Roslyn syntax parsing, reuse the TypeScript and Python ASTs, add scanner
   fixtures and stale-allowlist tests, and keep the production allowlist empty.
2. **Frontend foundation:** FE-1 and FE-17, establishing feature resource module
   conventions without redesigning any screen.
3. **Frontend schedule:** FE-2 and FE-3; keep schedule machine scopes and route
   identifiers constant.
4. **Frontend attendance:** FE-4; preserve backend-owned validation meaning and
   count formatting.
5. **Frontend clients core:** FE-5 and FE-6.
6. **Frontend client operations:** FE-7, FE-8 and FE-9, after resolving FE-12
   terminology duplicates.
7. **Frontend administration:** FE-10, FE-11, FE-13 and FE-14, implemented as
   separate commits so branch/user/group ownership remains reviewable.
8. **Frontend reporting:** FE-15 and FE-16.
9. **Backend client contracts:** BE-2, BE-3 and BE-4 with exact status,
   ProblemDetails, field-error and audit assertions.
10. **Backend group/schedule contracts:** BE-5 and BE-6.
11. **Backend adapter contracts:** BE-7 and BE-8; validate the bot consumer for
    every internal API wording family.
12. **Bot presentation:** BOT-1, BOT-2 and BOT-3; keep callback payloads and
    backend error ownership unchanged.
13. **Closure:** regenerate all shards, require zero `resource` candidates
    outside resources, require zero stale allowlist entries, run the guard over
    all production trees, and then run the full task verification contract.

Slices 2-12 are independent only after gate fixtures and the relevant
characterization are present. Cross-owner duplicate decisions are resolved
before either affected slice moves the literal. TASK-165 remains open until
all slices and closure evidence are integrated.

## Reproduction and review checklist

After `frontend/node_modules` is installed from the lockfile, regenerate the
proposal from repository root with:

```bash
TASK165_TYPESCRIPT_PATH=frontend/node_modules/typescript/lib/typescript.js \
python3 scripts/harness/generate_user_facing_text_inventory.py \
  --root . \
  --source-commit dfe9501775ba9e7ffdb4cf320b585ff82aabb72d \
  --output scripts/harness/config/user-facing-text-inventory-index.json \
  --allowlist-output scripts/harness/config/user-facing-text-allowlist.json \
  --duplicates-output scripts/harness/config/user-facing-text-duplicates.json
```

Review accepts the baseline only after all of the following are explicit:

- every `resource` candidate has the correct layer/feature owner;
- every exception has a category and reason, especially seeded data and the
  separately built component catalog;
- all 191 cross-owner duplicate groups have a keep-local or shared-meaning
  decision;
- English technical-looking ProblemDetails are not misclassified as machine
  codes;
- persisted audit data is excluded without excluding new audit descriptions;
- the empty allowlist is retained, or every added entry has exact identity,
  owner/task and a demonstrated parser limitation;
- slice sizes and ordering above are accepted or amended.
