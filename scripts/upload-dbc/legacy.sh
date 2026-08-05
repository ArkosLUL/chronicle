#!/usr/bin/env bash
# Upload DBC data to legacy Chronicle sites.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGETS=(
  # Format: server|api-url|dataset-id
  "triumvirate|https://legacy.chronicleclassic.com/|0aaca0ed-7f02-4c18-a94f-02491bcd0b88"
  "faebright|https://legacy.chronicleclassic.com/|de34ab0a-8542-4fe3-9bf9-f4503b58d999"
  "azerothcore|https://legacy.chronicleclassic.com/|e6606f7b-7e9e-4bc2-970b-bde8cd500a6b"
  "kronos|https://legacy.chronicleclassic.com/|0da7611b-a3a1-47d8-82a5-f383c43cd69d"
  "turtle|https://legacy.chronicleclassic.com/|a0404e03-e743-49e5-9876-7d5fa2931159"
  "octowow|https://legacy.chronicleclassic.com/|2e080ee0-ca21-47d3-a7f9-8c3ba638e1c4"
  "vanillaplus|https://legacy.chronicleclassic.com/|d77b88b5-97e9-4f6b-acc9-c291f546e475"
  "lunatic|https://legacy.chronicleclassic.com/|53f9c96d-2b9a-43d9-8244-ffc6c0bf4ce6"
)

#TARGETS=(
#  "azerothcore|http://localhost:4000|00000000-0000-0000-0000-000000000001"
#  "turtle|http://localhost:4000|d693ba3c-8bba-421d-8ae9-8eb2a65641cf"
#  "vanillaplus|http://localhost:4000|e1520e3b-32bb-48b9-b391-d2342a582b4e"
#  "faebright|http://localhost:4000/|58942539-2d80-44c9-8441-68aca794569c"
#)

source "$SCRIPT_DIR/run.sh"
