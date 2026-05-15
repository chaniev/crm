#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

# shellcheck source=deploy/lib/images.sh
source "$script_dir/lib/images.sh"

gym_crm_resolve_images "$repo_root"

archive_file="${1:-$script_dir/dist/gym-crm-images-$IMAGE_TAG.tar}"
image_env_file="${IMAGE_ENV_FILE:-${archive_file%.tar}.env}"
archive_dir="$(dirname "$archive_file")"
archive_name="$(basename "$archive_file")"
checksum_file="$archive_file.sha256"

mkdir -p "$archive_dir"

printf 'Exporting images to: %s\n' "$archive_file"
docker image inspect "$POSTGRES_IMAGE" "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$BOT_IMAGE" >/dev/null
save_args=()
if [[ -n "$IMAGE_PLATFORM" ]]; then
  save_args+=(--platform "$IMAGE_PLATFORM")
fi
docker save \
  "${save_args[@]}" \
  -o "$archive_file" \
  "$POSTGRES_IMAGE" \
  "$BACKEND_IMAGE" \
  "$FRONTEND_IMAGE" \
  "$BOT_IMAGE"

gym_crm_write_image_env "$image_env_file"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$archive_dir" && sha256sum "$archive_name" > "$archive_name.sha256")
else
  (cd "$archive_dir" && shasum -a 256 "$archive_name" > "$archive_name.sha256")
fi

printf 'Image env written to: %s\n' "$image_env_file"
printf 'Checksum written to: %s\n' "$checksum_file"
