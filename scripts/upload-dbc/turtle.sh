#!/usr/bin/env bash
# Upload DBC data to Turtle WoW Chronicle sites.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGETS=(
  # Format: server|api-url|dataset-id
  # "vanillaplus|https://chronicleclassic.com/|<dataset-uuid>"
)

source "$SCRIPT_DIR/run.sh"
