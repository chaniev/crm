# Triage selected inbox notes

Use for inbox processing. A global status audit is not a prerequisite; use the
classification and integrity rules in the parent skill.

## Scope and duplicate checks

1. Resolve the selected inbox files. When no selection is given, process the
   Markdown files in `backlog/inbox/`. Create only directories needed by the
   selected operation. If there are no notes, log and report that result.
2. Inspect the selected notes and identify related cards by user flow, goal,
   keywords, source references, and expected result. Search all active task
   folders, unfinished plans, and `backlog/done/` recursively. Inspect related
   code and history where needed; a similar title alone is not proof of a
   duplicate or completion.
3. Before processing each file, move it to `backlog/processing/` without
   overwriting an existing file. For an interrupted run, resume the matching
   processing file only after checking source ownership and tasks already
   created from it. Do not duplicate cards or silently take another run's work.

## Produce or update cards

- Group related ideas and deduplicate task creation without deleting text from
  the original source note.
- For a confirmed existing task, append the new source reference under
  `## Source notes`, explain the relationship under `## Processing notes`,
  and record the update. Preserve lifecycle and approval evidence.
- If overlap remains unresolved after inspecting available evidence, record
  the potential overlap and blocking question in `needs-clarification`.
- For a new task, allocate the next unused TASK number across active tasks,
  plans, and dated archives. Never reuse a number. Use
  `TASK-NNN-short-english-slug.md`; the card title may be Russian.
- Use [the task template](task-template.md), map requirements under the parent
  skill's rules, and classify the concrete change. Keep blocking questions in
  `needs-clarification`; a risky task records its required review and stop
  conditions. Do not move tasks to implementation as part of triage.

## Complete the source lifecycle

A source is complete only when every in-scope idea has a created or updated
card, or a recorded duplicate/disposition with traceability. A failure must
not cause silent loss of an idea.

Record task outcomes in `backlog/logs/triage-log.md`, then move a completed
source from `backlog/processing/` to `backlog/processed/`. Keep its original
body and add or update one metadata block:

```yaml
---
status: processed
processed_at: YYYY-MM-DD HH:mm
generated_tasks:
  - TASK-NNN-short-name.md
updated_existing_tasks:
  - TASK-MMM-existing-task.md
---
```

Use actual filenames; empty lists are valid for a recorded duplicate-only
result. Preserve existing metadata rather than duplicating it. On interruption
or incomplete processing, leave the source in `processing/`, record completed
work and the blocker, and resume from that evidence.

Verify final source links resolve after the move. Preserve the original note;
do not delete it or mark an incompletely processed source as processed.

## Log and handoff

Use a concise append-only entry containing the date/time and:

- mode: triage, with the selected source files;
- created and updated TASK paths, duplicate decisions, and remaining blockers;
- processed paths and any interrupted processing files;
- counts scoped to this run;
- validation performed and outcome.

For a full pass, add these results to the same run's status-audit entry. Report
changed artifacts and unresolved items, not the entire backlog tree.
