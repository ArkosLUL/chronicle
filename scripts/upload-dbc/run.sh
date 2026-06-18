#!/usr/bin/env bash
# Shared runner — sourced by per-site scripts.
# Expects TARGETS array to be set by the caller.
# Extra CLI flags ($@) are forwarded to each import run.
#
# Shows all targets upfront, asks once, then runs them all with --yes.

set -euo pipefail

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "No TARGETS defined." >&2
  exit 1
fi

echo "The following imports will run:"
echo
for entry in "${TARGETS[@]}"; do
  IFS='|' read -r server api_url dataset_id <<< "$entry"
  echo "  • server=${server}  url=${api_url}  dataset=${dataset_id}"
done
echo

read -rp "Proceed with all ${#TARGETS[@]} import(s)? [y/N] " answer
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  echo "Canceled."
  exit 0
fi
echo

failed=0
for entry in "${TARGETS[@]}"; do
  IFS='|' read -r server api_url dataset_id <<< "$entry"
  echo "==> Uploading to ${api_url} (server=${server}, dataset=${dataset_id})"
  if go run ./scripts/dbcdata import \
    --server "$server" \
    --api-url "$api_url" \
    --dataset-id "$dataset_id" \
    --yes \
    "$@"; then
    echo "    ✓ Success"
  else
    echo "    ✗ FAILED (exit $?)"
    failed=1
  fi
  echo
done

if [ "$failed" -ne 0 ]; then
  echo "Some uploads failed."
  exit 1
fi
echo "All uploads complete."
