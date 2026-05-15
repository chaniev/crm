#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s /path/to/gym-crm-images.tar\n' "$0" >&2
  exit 64
fi

docker load -i "$1"
