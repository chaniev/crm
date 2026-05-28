#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"
dotnet run --no-launch-profile --project backend/src/GymCrm.Api/GymCrm.Api.csproj -- --seed-test-data "$@"
