---
name: deploy-project
description: Deploy the CRM from main to an explicitly identified server using an isolated build workspace, verified artifacts, safe credential handling, and post-deployment health checks. Use only when the user explicitly requests deployment and supplies the target access context.
---

# Deploy project to server from `main`

## Purpose

Use this skill when the user asks the coding agent to deploy the project to a
specified server using provided access parameters.

The skill must:

1. Create an isolated local working directory for the deployment.
2. Download the project source code from the `main` branch.
3. Build the required components.
4. Update the specified server using the provided deployment parameters.
5. Verify the deployment result.
6. Avoid leaking secrets, tokens, passwords, private keys, or server credentials into logs, commits, artifacts, or generated files.

## When to use

Use this skill for requests like:

- “Deploy the project to the server.”
- “Using these SSH credentials, update the server from main.”
- “Build backend/frontend and deploy to production/staging.”
- “Download the code from main, build it, and update the server.”

Do not use this skill for:

- Local-only builds without server update.
- Database-only migrations.
- Infrastructure redesign.
- Deployment to an unspecified server when no access parameters or deployment target are provided.

## Required input from the user

Before starting, Codex must have enough information to identify:

- Repository URL.
- Target branch. Default: `main`.
- Server host or IP.
- SSH user.
- SSH port. Default: `22`.
- Authentication method:
  - SSH private key path available locally; or
  - SSH agent; or
  - another explicitly provided secure method.
- Target environment: for example `staging`, `production`, `test`.
- Deployment path on the server.
- Components to build and deploy:
  - backend;
  - frontend;
  - bot;
  - worker;
  - other project-specific services.
- Build commands for each component, unless they are already documented in the repository.
- Service restart commands or deployment command on the server.
- Health-check URL or verification command.

If any required value is missing, ask for the smallest possible missing set. Do not guess production credentials, server paths, or restart commands.

## Security rules

- Never store secrets in the repository.
- Never write passwords, tokens, private keys, or `.env` contents into `SKILL.md`, logs, markdown reports, shell history, commits, or artifacts.
- Never echo secrets to the terminal.
- Never commit generated deployment files unless the user explicitly asks and the files contain no secrets.
- Use environment variables, SSH agent, or locally provided private key paths instead of embedding credentials in commands.
- Before running destructive commands on the server, clearly identify the target host and path.
- Do not run `rm -rf` against broad or ambiguous paths.
- Do not deploy from a dirty local working tree. Always clone/fetch into a fresh isolated directory.
- Prefer atomic deployment patterns where possible: upload to a release directory, switch symlink, then restart services.
- Keep a rollback point when the existing server layout supports it.

## Isolated local workspace

Create a fresh deployment workspace outside the user’s project directory.

Recommended location:

```bash
/tmp/codex-deploy-<project-name>-<timestamp>
```

Requirements:

- The workspace must be unique for each deployment run.
- The workspace must not reuse an old checkout.
- The workspace must be removed after successful deployment unless the user asks to keep it for debugging.
- If deployment fails, keep the workspace and print its path for investigation.

Example:

```bash
DEPLOY_TS="$(date +%Y%m%d-%H%M%S)"
WORKDIR="/tmp/codex-deploy-${PROJECT_NAME}-${DEPLOY_TS}"
mkdir -p "$WORKDIR"
```

## Repository checkout

Clone the repository into the isolated workspace and checkout `main` unless the user explicitly provides another branch.

```bash
git clone --branch main --single-branch "$REPO_URL" "$WORKDIR/source"
cd "$WORKDIR/source"
git status --short
git rev-parse --short HEAD
```

Validate:

- Branch is `main`.
- Working tree is clean.
- Commit hash is captured for the deployment report.

```bash
CURRENT_BRANCH="$(git branch --show-current)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: expected branch main, got $CURRENT_BRANCH"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean"
  exit 1
fi
```

## Dependency installation

Install dependencies using the package manager and lockfile present in the repository.

Examples:

### Frontend

Prefer lockfile-based install:

```bash
cd "$WORKDIR/source/frontend"

if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
elif [ -f package-lock.json ]; then
  npm ci
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile
else
  npm install
fi
```

### Backend

Use the project’s documented backend setup. Examples:

```bash
# .NET
cd "$WORKDIR/source/backend"
dotnet restore

# Node.js backend
cd "$WORKDIR/source/backend"
npm ci

# Python backend
cd "$WORKDIR/source/backend"
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Do not invent dependency commands if the repository clearly documents a different process.

## Build components

Build only the components requested by the user or required by the project deployment instructions.

Examples:

### Frontend build

```bash
cd "$WORKDIR/source/frontend"
npm run build
```

### Backend build

```bash
cd "$WORKDIR/source/backend"

# .NET example
dotnet publish -c Release -o "$WORKDIR/artifacts/backend"

# Node.js example
npm run build
```

### Bot / worker build

```bash
cd "$WORKDIR/source/bot"
npm ci
npm run build
```

After each build:

- Check the command exit code.
- Confirm that the expected artifact directory exists.
- Do not continue deployment after a failed build.

## Pre-deployment server checks

Before changing the server, verify connectivity and target paths.

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" 'hostname && pwd && whoami'
```

Check deployment directory:

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "test -d '$REMOTE_DEPLOY_PATH' && echo OK"
```

If the target path does not exist, ask the user before creating it unless the user explicitly allowed creation.

## Deployment strategy

Prefer release-based deployment:

```text
<REMOTE_DEPLOY_PATH>/
  releases/
    20260521-120000/
  current -> releases/20260521-120000
  shared/
```

Recommended flow:

1. Create a new release directory on the server.
2. Upload build artifacts to the new release directory.
3. Preserve server-side environment files from `shared/`.
4. Switch the `current` symlink atomically.
5. Restart required services.
6. Run health checks.
7. Keep previous release for rollback.

Example:

```bash
RELEASE_ID="$(date +%Y%m%d-%H%M%S)-${CURRENT_COMMIT}"
REMOTE_RELEASE_PATH="$REMOTE_DEPLOY_PATH/releases/$RELEASE_ID"

ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "mkdir -p '$REMOTE_RELEASE_PATH'"
rsync -az --delete -e "ssh -p $SSH_PORT" "$WORKDIR/artifacts/" "$SSH_USER@$SSH_HOST:$REMOTE_RELEASE_PATH/"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "ln -sfn '$REMOTE_RELEASE_PATH' '$REMOTE_DEPLOY_PATH/current'"
```

If the existing server deployment model does not use releases/symlinks, follow the project’s documented deployment method, but still:

- back up replaced files where practical;
- avoid deleting unrelated files;
- verify target paths carefully.

## Service restart

Restart only the services explicitly related to the deployed components.

Examples:

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl restart my-backend.service"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl restart my-bot.service"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl reload nginx"
```

If `sudo` requires an interactive password and no safe non-interactive method is configured, stop and ask the user to configure server permissions or provide the correct deployment command. Do not ask the user to paste sudo passwords into chat.

## Health checks

After deployment, run available checks.

Examples:

```bash
curl -fsS "$HEALTHCHECK_URL"
```

Server-side checks:

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "systemctl is-active my-backend.service"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "journalctl -u my-backend.service -n 50 --no-pager"
```

If health checks fail:

1. Do not claim the deployment succeeded.
2. Capture the failing command and non-secret output.
3. If release-based deployment is available, rollback to the previous release.
4. Report what changed and what failed.

## Rollback

If release-based deployment is used, rollback by switching `current` back to the previous release and restarting services.

Example:

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "ls -1dt '$REMOTE_DEPLOY_PATH'/releases/* | head -n 2"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "ln -sfn '<PREVIOUS_RELEASE_PATH>' '$REMOTE_DEPLOY_PATH/current'"
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl restart my-backend.service"
```

Rollback must be performed when:

- the new service does not start;
- health check fails;
- critical user scenario is broken immediately after deployment;
- the user explicitly asks to rollback.

## Deployment report

At the end, provide a concise report:

```text
Deployment result: success / failed / rolled back
Repository: <repo url without token>
Branch: main
Commit: <short hash>
Server: <host>
Environment: <environment>
Components built: <list>
Components deployed: <list>
Services restarted: <list>
Health checks: <result>
Release path: <remote release path>
Rollback point: <previous release path, if available>
Local workspace: removed / kept at <path>
```

Do not include secrets in the report.

## Default execution checklist

Use this checklist for every deployment:

1. Confirm required deployment parameters are available.
2. Create isolated local workspace.
3. Clone repository from `main`.
4. Verify clean checkout and capture commit hash.
5. Install dependencies using lockfiles.
6. Build requested components.
7. Verify build artifacts.
8. Test SSH connectivity.
9. Verify remote deployment path.
10. Create remote release directory.
11. Upload artifacts.
12. Switch active release or update target directory.
13. Restart required services.
14. Run health checks.
15. Rollback if checks fail.
16. Remove local workspace after success.
17. Return deployment report.

## Example user prompt for Codex

```text
Используй skill deploy-project-to-server.

Параметры:
- repo: git@github.com:company/project.git
- branch: main
- environment: staging
- server: 10.0.0.10
- ssh user: deploy
- ssh port: 22
- auth: SSH agent
- remote path: /var/www/project
- components: backend, frontend
- backend build: dotnet publish -c Release -o /tmp/artifacts/backend
- frontend build: npm ci && npm run build
- frontend artifact path: frontend/dist
- restart commands:
  - sudo systemctl restart project-backend
  - sudo systemctl reload nginx
- healthcheck: https://staging.example.com/health

Скачай исходный код в изолированную локальную папку, собери компоненты и обнови сервер.
Секреты в логи и файлы не записывай.
```

## Notes for Codex

- Prefer existing project scripts over generic commands.
- Prefer documented deployment instructions from the repository if present.
- If `README`, `AGENTS.md`, `docs/deploy.md`, `.github/workflows`, or deployment scripts exist, inspect them before inventing commands.
- If the repository contains multiple apps, build only requested components unless dependencies require more.
- If the server has Docker Compose deployment, use the documented compose flow instead of copying raw artifacts.
- If database migrations are part of deployment, do not run them automatically unless the user explicitly requested this and rollback implications are understood.
