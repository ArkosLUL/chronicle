#!/usr/bin/env bash
# Run `dbcdata import` in a throwaway Go container to upload DBC game data from
# the WoW client into a Chronicle dataset.
#
# Two reasons this isn't a plain `go run`:
#   * there is no Go toolchain on the host
#   * the WoW client's DBCs have to be read through an enUS-only view (see below)
#
# The client has deDE/enUS/esES/frFR/ruRU installed. content.Open walks every .mpq
# under the client directory with no locale parameter, and ruru/frfr sort after
# enus, so DBFilesClient\*.dbc resolves to the Russian and French archives —
# localized spell, talent and item-set names. Masking the other locale
# directories with empty tmpfs mounts leaves enus as the only locale in the pool
# while keeping WoW.exe and the rest of the layout intact, which version detection
# needs (a flattened symlink farm makes it fall back to bruteforce and panic on
# patch-2.mpq).
#
# Auth: export CHRONICLE_COOKIE with the chronicle_auth_session cookie from a
# logged-in admin browser session and the CLI trades it for a JWT via
# /whoami/dump. CHRONICLE_TOKEN works too if you already have a bearer token.
# Either way the account needs CanAdmin_world_data.
#
# Usage: scripts/import_azerothcore_dbc.sh [extra dbcdata import flags...]
set -euo pipefail

REPO_DIR="${REPO_DIR:-g:/DevStuff/GitHub/Chronicle/chronicle}"
CLIENT_DIR="${CLIENT_DIR:-A:/WOW/world of warcraft 3.3.5a hd}"
GO_IMAGE="${GO_IMAGE:-golang:1.25.7-alpine3.22}"
NETWORK="${CHRONICLE_NETWORK:-chronicle_default}"
API_URL="${API_URL:-http://app:4000}"
DATASET_ID="${DATASET_ID:-00000000-0000-0000-0000-000000000001}"
IMPORTS="${IMPORTS:-all}"

if [ -z "${CHRONICLE_TOKEN:-}" ] && [ -z "${CHRONICLE_COOKIE:-}" ]; then
    echo "Set CHRONICLE_COOKIE (chronicle_auth_session value) or CHRONICLE_TOKEN." >&2
    exit 1
fi

# Git Bash rewrites container-side absolute paths without this.
export MSYS_NO_PATHCONV=1

# --yes means no TUI, so a TTY is only nice-to-have for progress output.
TTY_FLAGS=()
if [ -t 0 ] && [ -t 1 ]; then
    TTY_FLAGS=(-it)
fi

docker run --rm "${TTY_FLAGS[@]}" \
    -v "${REPO_DIR}:/src" \
    -v "${CLIENT_DIR}:/wow:ro" \
    -v chronicle-gomod:/go/pkg/mod \
    --tmpfs /wow/Data/dede \
    --tmpfs /wow/Data/eses \
    --tmpfs /wow/Data/frfr \
    --tmpfs /wow/Data/ruru \
    --network "$NETWORK" \
    -e WOW_CLIENT_PATH=/wow \
    -e CHRONICLE_TOKEN="${CHRONICLE_TOKEN:-}" \
    -e CHRONICLE_COOKIE="${CHRONICLE_COOKIE:-}" \
    -w /src \
    "$GO_IMAGE" \
    go run ./scripts/dbcdata import \
    --server=azerothcore \
    --api-url="$API_URL" \
    --dataset-id="$DATASET_ID" \
    --import="$IMPORTS" \
    --mode=upsert \
    --yes \
    "$@"
