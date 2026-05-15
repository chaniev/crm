#!/usr/bin/env bash

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
