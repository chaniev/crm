---
name: task-worktree
description: Create, resume, verify, and safely clean up isolated Git worktrees for CRM implementation tasks. Use before starting or resuming any task that changes project code, when several tasks must run in parallel, when an implementation plan declares a branch, when a task needs an isolated Docker Compose stack, or when a merged task workspace must be removed.
---

# Task worktree

Keep the primary repository directory on `main`. Perform implementation only
in a dedicated task branch checked out in a separate Git worktree.

## Establish the task identity

Determine:

- task ID and short name;
- intended branch from the implementation plan, if present;
- primary repository directory;
- worktree parent directory;
- whether project services must run for this task.

Use the plan's branch verbatim. Otherwise choose exactly one prefix:

```text
feature/TASK-XXX-short-name
fix/TASK-XXX-short-name
refactor/TASK-XXX-short-name
```

Default the worktree path to a sibling of the primary repository:

```text
../crm-worktrees/TASK-XXX-short-name
```

Adjust the parent path to the user's local layout when necessary, but keep the
task worktree outside the primary repository directory.

## Inspect before mutating

From any directory inside the repository, inspect:

```bash
git rev-parse --show-toplevel
git status --short --branch
git remote -v
git worktree list --porcelain
git branch --list '<intended-branch>'
git branch --remotes --list 'origin/<intended-branch>'
```

Locate the primary worktree from `git worktree list --porcelain`; do not assume
the current directory is primary.

Stop and report the conflict when:

- the task branch is checked out in another worktree;
- a target directory exists but is not the registered task worktree;
- a branch or worktree appears to belong to another task;
- the intended branch differs from the implementation plan;
- the primary worktree has unexplained changes that make coordination unsafe.

Do not delete, overwrite, stash, reset, or force-clean existing work.

## Refresh the base

Run from the primary repository:

```bash
git fetch origin
git show-ref --verify --quiet refs/remotes/origin/main
```

Use `origin/main` as the base. Do not require switching or pulling the primary
worktree to create a task workspace.

## Resume an existing workspace

If the intended branch is already assigned to a registered worktree:

1. reuse that worktree;
2. verify its branch and status;
3. continue only when its existing changes belong to the same task;
4. do not create a duplicate branch or worktree.

If the local branch exists but has no worktree:

```bash
git worktree add '<worktree-path>' '<intended-branch>'
```

If only the remote task branch exists:

```bash
git worktree add \
  -b '<intended-branch>' \
  '<worktree-path>' \
  'origin/<intended-branch>'
```

Do not rebase or reset an existing task branch merely to make it match the
latest `origin/main`. Report base drift and follow the task's integration
decision.

## Create a new workspace

Only when neither a local nor remote task branch exists, run:

```bash
git worktree add \
  -b '<intended-branch>' \
  '<worktree-path>' \
  origin/main
```

Continue the task from `<worktree-path>`. Do not change project code in the
primary repository directory.

## Verify before implementation

Inside the task worktree, run:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short --branch
git merge-base --is-ancestor origin/main HEAD
```

Confirm:

- repository root equals the registered task worktree;
- current branch equals the intended branch;
- status contains no unexplained changes;
- `origin/main` is an ancestor for a newly created task branch.

The ancestor check does not prove that an old resumed branch is current.
Report its base drift rather than silently rebasing it.

Return the verified worktree path, branch, base, and current commit before
implementation begins.

## Isolate a local CRM stack

Skip runtime setup when the task needs only static checks or component-level
tests.

When starting Docker Compose, create a task-local `.env` from
`deploy/.env.example`. Never commit it.

Set unique values:

```env
COMPOSE_PROJECT_NAME=crm-task-xxx
BACKEND_PORT=<unused-host-port>
FRONTEND_PORT=<unused-host-port>
BOT_ENABLED=false
```

Before choosing ports, inspect active Compose projects and listening ports.
Do not derive a port only from the task number without checking availability.

Keep `BOT_ENABLED=false` by default. Enable it only when:

- bot runtime validation is required;
- its Telegram token is configured locally;
- no other running stack uses that token for long polling.

Start and operate the stack with the task-local environment:

```bash
docker compose \
  --project-directory . \
  --env-file .env \
  -f deploy/docker-compose.yml \
  up --build -d
```

Never use another task's Compose project, ports, containers, networks, or
volumes.

## Handoff after implementation

Before handoff:

1. run repository-required validation;
2. verify intended changes are committed;
3. verify no unexplained files remain;
4. push the task branch when the user requested or the workflow requires it;
5. report worktree path, branch, commit SHA, validation, and runtime project.

Do not remove the task worktree merely because implementation is complete.
Keep it until the branch is merged or the user explicitly requests cleanup.

## Clean up safely

Before cleanup, resolve the exact worktree, branch, and Compose project.
Confirm:

- the worktree belongs to the requested task;
- no required uncommitted changes remain;
- required commits are available outside the worktree;
- the branch is merged, or the user explicitly authorized removal;
- no task stack must remain running.

Stop the exact task stack without deleting volumes by default:

```bash
docker compose \
  --project-name '<compose-project>' \
  --project-directory '<worktree-path>' \
  --env-file '<worktree-path>/.env' \
  -f '<worktree-path>/deploy/docker-compose.yml' \
  down
```

Remove the worktree and prune stale administrative records:

```bash
git worktree remove '<worktree-path>'
git worktree prune
```

Delete the local task branch only after confirming it is merged:

```bash
git branch -d '<intended-branch>'
```

Do not use `git worktree remove --force`, `git branch -D`, destructive resets,
or `docker compose down -v` as normal cleanup. Require explicit user approval
and an exact target for destructive cleanup.
