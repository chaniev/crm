#!/usr/bin/env bash

gym_crm_default_tmp_dir() {
  local tmp_base="${TMPDIR:-/tmp}"
  printf '%s\n' "${tmp_base%/}"
}

gym_crm_default_image_tag() {
  local repo_root="$1"
  local git_tag

  if git_tag="$(git -C "$repo_root" rev-parse --short HEAD 2>/dev/null)"; then
    printf '%s\n' "$git_tag"
    return
  fi

  date -u +%Y%m%d%H%M%S
}

gym_crm_resolve_env_file() {
  local repo_root="$1"
  local requested="${ENV_FILE:-$repo_root/.env}"

  if [[ -f "$requested" ]]; then
    printf '%s\n' "$requested"
    return
  fi

  printf '%s\n' "$repo_root/deploy/.env.example"
}

gym_crm_default_build_cache_root() {
  local repo_root="$1"
  local tmp_base="${TMPDIR:-/tmp}"
  python3 - "$repo_root" "${DEPLOY_BUILD_CACHE_ROOT:-${tmp_base%/}/gym-crm-release-build-cache}" <<'PYROOT'
from pathlib import Path
import sys
repo, cache = (Path(arg).resolve() for arg in sys.argv[1:])
if cache == repo or repo in cache.parents or any(c in str(cache) for c in ",\n\r$"):
    raise SystemExit("Build cache must be outside the checkout and its path cannot contain commas, newlines or dollar signs.")
print(cache)
PYROOT
}

gym_crm_cache_is_valid() {
  python3 - "$1" <<'PYCACHE'
from pathlib import Path
import json
import sys
try:
    root = Path(sys.argv[1])
    index = json.loads((root / "index.json").read_text())
    assert index["schemaVersion"] == 2 and index["manifests"]
    for manifest in index["manifests"]:
        algorithm, digest = manifest["digest"].split(":", 1)
        assert algorithm == "sha256" and len(digest) == 64
        assert all(c in "0123456789abcdef" for c in digest)
        assert (root / "blobs" / algorithm / digest).is_file()
except (OSError, ValueError, KeyError, TypeError, AssertionError):
    raise SystemExit(1)
PYCACHE
}

gym_crm_lock_cache_root() {
  local cache_root="$1"
  local timeout_seconds="${2:-120}"
  local lock_dir="${cache_root}/.build-lock"
  local deadline=$((SECONDS + timeout_seconds))

  mkdir -m 700 -p "$cache_root"

  while true; do
    if mkdir "$lock_dir" 2>/dev/null; then
      printf '%s\n' "$lock_dir"
      return 0
    fi

    if ((SECONDS > deadline)); then
      printf 'Timed out waiting for build cache lock %s\n' "$cache_root" >&2
      return 1
    fi
    sleep 0.2
  done
}

gym_crm_release_cache_root_lock() {
  local lock_dir="$1"
  if [[ -n "$lock_dir" ]]; then
    rmdir "$lock_dir"
  fi
}

gym_crm_buildx_builder_name() {
  printf '%s\n' "${GYM_CRM_BUILDKIT_BUILDER_NAME:-gym-crm-release-builder}"
}

gym_crm_ensure_docker_container_builder() {
  local builder_name="$1"
  local status_output
  local driver_line

  if ! docker buildx inspect "$builder_name" >/dev/null 2>&1; then
    if ! docker buildx create --name "$builder_name" --driver docker-container >/dev/null; then
      printf 'Failed to create docker-container BuildKit builder %s\n' "$builder_name" >&2
      return 1
    fi
  fi

  status_output="$(docker buildx inspect "$builder_name" 2>/dev/null || true)"
  driver_line="$(printf '%s\n' "$status_output" | awk '/^Driver:/ {print $2; exit}')"
  if [[ "$driver_line" != "docker-container" ]]; then
    printf 'BuildKit cache export requires docker-container driver, got %s for %s\n' "${driver_line:-unknown}" "$builder_name" >&2
    return 1
  fi

  if ! docker buildx inspect "$builder_name" --bootstrap >/dev/null 2>&1; then
    printf 'Failed to bootstrap BuildKit builder %s\n' "$builder_name" >&2
    return 1
  fi
}

gym_crm_resolve_images() {
  local repo_root="$1"
  IMAGE_TAG="${IMAGE_TAG:-$(gym_crm_default_image_tag "$repo_root")}"
  IMAGE_PREFIX="${IMAGE_PREFIX:-gym-crm}"
  IMAGE_PLATFORM="${IMAGE_PLATFORM:-}"

  POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
  BACKEND_IMAGE="${BACKEND_IMAGE:-$IMAGE_PREFIX/backend:$IMAGE_TAG}"
  FRONTEND_IMAGE="${FRONTEND_IMAGE:-$IMAGE_PREFIX/frontend:$IMAGE_TAG}"
  BOT_IMAGE="${BOT_IMAGE:-$IMAGE_PREFIX/bot:$IMAGE_TAG}"

  export IMAGE_TAG IMAGE_PREFIX IMAGE_PLATFORM POSTGRES_IMAGE BACKEND_IMAGE FRONTEND_IMAGE BOT_IMAGE
}

gym_crm_cache_context() {
  local service="$1"
  local image_platform="$2"
  local cache_root="${DEPLOY_BUILD_CACHE_ROOT:?}"
  local platform_tag

  if [[ -n "$image_platform" ]]; then
    platform_tag="${image_platform//\//-}"
  else
    platform_tag="native"
  fi

  printf '%s\n' "$cache_root/cache-$platform_tag/$service"
}

gym_crm_cache_context_pending() {
  local service="$1"
  local image_platform="$2"
  local run_id="${3:-pending}"

  printf '%s\n' "$(gym_crm_cache_context "$service" "$image_platform").$run_id.pending"
}

gym_crm_rotate_cache() {
  local service="${1}"
  local cache_platform="${2:-}"
  local pending_cache="${3:-}"
  local active_cache
  local pending_cache_target
  local backup_cache

  active_cache="$(gym_crm_cache_context "$service" "$cache_platform")"
  mkdir -p "$(dirname "$active_cache")"
  if [[ -n "$pending_cache" ]]; then
    pending_cache_target="$pending_cache"
  else
    pending_cache_target="$(gym_crm_cache_context_pending "$service" "$cache_platform")"
  fi

  if ! gym_crm_cache_is_valid "$pending_cache_target"; then
    printf 'Invalid cache export: %s\n' "$pending_cache_target" >&2
    return 1
  fi

  if [[ -d "$active_cache" ]]; then
    backup_cache="${active_cache}.previous"
    rm -rf "$backup_cache"
    if mv "$active_cache" "$backup_cache"; then
      if mv "$pending_cache_target" "$active_cache"; then
        rm -rf "$backup_cache"
      else
        mv "$backup_cache" "$active_cache"
        return 1
      fi
    else
      printf 'Failed to snapshot current cache state for service %s\n' "$service" >&2
      return 1
    fi
  else
    mv "$pending_cache_target" "$active_cache"
  fi
}

gym_crm_write_image_env() {
  local output_file="$1"

  mkdir -p "$(dirname "$output_file")"
  {
    printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG"
    printf 'POSTGRES_IMAGE=%s\n' "$POSTGRES_IMAGE"
    printf 'BACKEND_IMAGE=%s\n' "$BACKEND_IMAGE"
    printf 'FRONTEND_IMAGE=%s\n' "$FRONTEND_IMAGE"
    printf 'BOT_IMAGE=%s\n' "$BOT_IMAGE"
    if [[ -n "$IMAGE_PLATFORM" ]]; then
      printf 'IMAGE_PLATFORM=%s\n' "$IMAGE_PLATFORM"
    fi
  } > "$output_file"
}
