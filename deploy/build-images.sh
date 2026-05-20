#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

# shellcheck source=deploy/lib/images.sh
source "$script_dir/lib/images.sh"

gym_crm_resolve_images "$repo_root"
env_file="$(gym_crm_resolve_env_file "$repo_root")"
image_env_file="${IMAGE_ENV_FILE:-$script_dir/dist/gym-crm-images-$IMAGE_TAG.env}"

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

for service in backend frontend bot; do
  docker compose \
    --project-directory "$repo_root" \
    --env-file "$env_file" \
    -f "$script_dir/docker-compose.yml" \
    build "$service"
done

if [[ -n "$IMAGE_PLATFORM" ]]; then
  docker pull --platform "$IMAGE_PLATFORM" "$POSTGRES_IMAGE"
else
  docker pull "$POSTGRES_IMAGE"
fi
gym_crm_write_image_env "$image_env_file"

printf 'Image env written to: %s\n' "$image_env_file"
