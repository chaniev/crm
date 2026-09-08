#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

# shellcheck source=deploy/lib/images.sh
source "$script_dir/lib/images.sh"

gym_crm_resolve_images "$repo_root"
DEPLOY_BUILD_CACHE_ROOT="$(gym_crm_default_build_cache_root "$repo_root")"
export DEPLOY_BUILD_CACHE_ROOT
env_file="$(gym_crm_resolve_env_file "$repo_root")"
image_env_file="${IMAGE_ENV_FILE:-$script_dir/dist/gym-crm-images-$IMAGE_TAG.env}"

umask 077
cache_root_lock="$(gym_crm_lock_cache_root "$DEPLOY_BUILD_CACHE_ROOT")"
temp_build_override_file=""
cleanup_cache_artifacts() {
  [[ -z "$temp_build_override_file" ]] || rm -f "$temp_build_override_file"
  gym_crm_release_cache_root_lock "$cache_root_lock"
}
trap cleanup_cache_artifacts EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
pending_root="$(mktemp -d "$DEPLOY_BUILD_CACHE_ROOT/export.XXXXXX")"
temp_build_override_file="$pending_root/compose-cache.json"

printf 'Using cache root: %s\n' "$DEPLOY_BUILD_CACHE_ROOT"

printf 'Using env file: %s\n' "$env_file"
printf 'Building images:\n'
printf '  backend:  %s\n' "$BACKEND_IMAGE"
printf '  frontend: %s\n' "$FRONTEND_IMAGE"
printf '  bot:      %s\n' "$BOT_IMAGE"
printf '  postgres: %s\n' "$POSTGRES_IMAGE"
if [[ -n "$IMAGE_PLATFORM" ]]; then
  printf '  platform: %s\n' "$IMAGE_PLATFORM"
  export DOCKER_DEFAULT_PLATFORM="$IMAGE_PLATFORM"
fi

builder_name="$(gym_crm_buildx_builder_name)"
if ! gym_crm_ensure_docker_container_builder "$builder_name"; then
  printf 'Build cache export prerequisites are not met. BuildKit cache exports disabled for this run.\n' >&2
  exit 1
fi

export DEPLOY_BUILD_CACHE_ROOT
python3 - "$temp_build_override_file" "$pending_root" "${IMAGE_PLATFORM:-native}" <<'PYOVERRIDE'
from pathlib import Path
import json
import os
import sys
output, pending_root, platform = sys.argv[1:]
root = Path(os.environ["DEPLOY_BUILD_CACHE_ROOT"]) / ("cache-" + platform.replace("/", "-"))
services = {}
for service in ("backend", "frontend", "bot"):
    active = root / service
    pending = Path(pending_root) / service
    pending.mkdir()
    build = {"cache_to": [f"type=local,dest={pending},mode=max"]}
    # BuildKit validates blob checksums. Missing or malformed index files are a cache miss.
    try:
        index = json.loads((active / "index.json").read_text())
        if index.get("schemaVersion") == 2 and index.get("manifests"):
            build["cache_from"] = [f"type=local,src={active}"]
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    services[service] = {"build": build}
Path(output).write_text(json.dumps({"services": services}))
PYOVERRIDE

for service in backend frontend bot; do
  cache_to="$pending_root/$service"

  docker compose \
    --project-directory "$repo_root" \
    --env-file "$env_file" \
    -f "$script_dir/docker-compose.yml" \
    -f "$temp_build_override_file" \
    build --builder "$builder_name" "$service"
  if ! gym_crm_rotate_cache "$service" "$IMAGE_PLATFORM" "$cache_to"; then
    printf 'Failed to update cache state for service %s\n' "$service" >&2
    exit 1
  fi
done

rm -f "$temp_build_override_file"
temp_build_override_file=""
rmdir "$pending_root"

if [[ -n "$IMAGE_PLATFORM" ]]; then
  docker pull --platform "$IMAGE_PLATFORM" "$POSTGRES_IMAGE"
else
  docker pull "$POSTGRES_IMAGE"
fi
gym_crm_write_image_env "$image_env_file"

printf 'Image env written to: %s\n' "$image_env_file"
