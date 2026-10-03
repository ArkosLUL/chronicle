#!/usr/bin/env bash
# Upload DBC data to legacy Chronicle sites.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WOWDATA_TARGETS=(
  "wow-forever|/home/steven/.steam/steam/steamapps/compatdata/3492500670/pfx/drive_c/Program Files (x86)/World of Warcraft|https://legacy.chronicleclassic.com/|b69b601c-d247-44c6-9cb6-3f71053fd052|wow_classic_beta|1.60.1.70205"
)

source "$SCRIPT_DIR/run.sh"
