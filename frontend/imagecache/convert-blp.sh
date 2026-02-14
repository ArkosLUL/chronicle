#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLP_DIR="${SCRIPT_DIR}/blp"
ICONS_DIR="${SCRIPT_DIR}/icons"

if [[ ! -d "$BLP_DIR" ]]; then
  echo "Error: BLP directory not found: $BLP_DIR"
  exit 1
fi

mkdir -p "$ICONS_DIR"

# Count files for progress
total=$(find "$BLP_DIR" -iname "*.blp" | wc -l)
current=0

echo "Converting $total BLP files to WebP..."

find "$BLP_DIR" -iname "*.blp" | while read -r blp_file; do
  current=$((current + 1))
  
  # Get base name without extension, lowercase
  base_name=$(basename "$blp_file" | sed 's/\.[bB][lL][pP]$//' | tr '[:upper:]' '[:lower:]')
  webp_file="${ICONS_DIR}/${base_name}.webp"
  
  # Temp PNG file
  tmp_png=$(mktemp --suffix=.png)
  trap "rm -f '$tmp_png'" EXIT
  
  echo "[$current/$total] $base_name"
  
  # BLP → PNG using Python + Pillow (has native BLP support)
  if ! python3 -c "
from PIL import Image
img = Image.open('$blp_file')
img.save('$tmp_png', 'PNG')
"; then
    echo "  Error: Failed to convert $blp_file"
    exit 1
  fi
  
  # PNG → WebP (quality 80, good balance for icons)
  if ! cwebp -q 80 "$tmp_png" -o "$webp_file"; then
    echo "  Error: Failed to encode WebP for $base_name"
    exit 1
  fi
  
  rm -f "$tmp_png"
done

echo ""
echo "Done! Converted files are in: $ICONS_DIR"
echo "Total WebP files: $(find "$ICONS_DIR" -name "*.webp" | wc -l)"
