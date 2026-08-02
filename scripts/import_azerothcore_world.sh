#!/usr/bin/env bash
# Run `chronicle import-world --server=azerothcore` in a throwaway Go container.
#
# Two reasons this isn't a plain `go run`:
#   * the app image ships only `chronicled`, and there is no Go toolchain on the host
#   * the WoW client's DBCs have to be read through an enUS-only view (see below)
#
# The client has deDE/enUS/esES/frFR/ruRU installed. content.Open walks every .mpq
# under the client directory with no locale parameter, and ruru/frfr sort after
# enus, so DBFilesClient\*.dbc resolves to the Russian and French archives —
# localized enchant, item-set and random-property names. Masking the other locale
# directories with empty tmpfs mounts leaves enus as the only locale in the pool
# while keeping WoW.exe and the rest of the layout intact, which version detection
# needs (a flattened symlink farm makes it fall back to bruteforce and panic on
# patch-2.mpq).
#
# Usage: scripts/import_azerothcore_world.sh [extra import-world flags...]
set -euo pipefail

REPO_DIR="${REPO_DIR:-g:/DevStuff/GitHub/Chronicle/chronicle}"
CLIENT_DIR="${CLIENT_DIR:-A:/WOW/world of warcraft 3.3.5a hd}"
GO_IMAGE="${GO_IMAGE:-golang:1.25.7-alpine3.22}"
NETWORK="${CHRONICLE_NETWORK:-chronicle_default}"
DB_URL="${DB_URL:-postgres://postgres:postgres@postgres:5432/chronicle?sslmode=disable}"

# Git Bash rewrites container-side absolute paths without this.
export MSYS_NO_PATHCONV=1

docker run --rm -it \
    -v "${REPO_DIR}:/src" \
    -v "${CLIENT_DIR}:/wow:ro" \
    -v chronicle-gomod:/go/pkg/mod \
    --tmpfs /wow/Data/dede \
    --tmpfs /wow/Data/eses \
    --tmpfs /wow/Data/frfr \
    --tmpfs /wow/Data/ruru \
    --network "$NETWORK" \
    -e WOW_CLIENT_PATH=/wow \
    -w /src \
    "$GO_IMAGE" \
    go run --tags azerothcore ./cmd/chronicle import-world \
    --server=azerothcore \
    --db-url="$DB_URL" \
    "$@"
