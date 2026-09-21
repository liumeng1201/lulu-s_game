#!/bin/sh
set -eu

asset_dir=${1:-games/explore-world/assets/characters}
cell=256
gutter=${2:-12}
failed=0

for file in "$asset_dir"/*.png; do
  dimensions=$(identify -format '%wx%h' "$file")
  if [ "$dimensions" != "1024x1024" ]; then
    echo "invalid dimensions: $file ($dimensions)"
    failed=1
    continue
  fi
  empty_frames=$(convert "$file" -alpha extract -scale 4x4\! txt:- |
    awk -F '[,:()]' 'NR > 1 { gsub(/ /, "", $4); if (($4 + 0) == 0) empty[$1 "," $2] = 1 } END { for (cell in empty) print cell }')
  if [ -n "$empty_frames" ]; then
    echo "empty frame: $file ($empty_frames)"
    failed=1
  fi
  vertical_bleed=$(convert "$file" -alpha extract -scale 4x1024\! txt:- |
    awk -F '[,:()]' -v gutter="$gutter" 'NR > 1 { gsub(/ /, "", $2); gsub(/ /, "", $4); y = $2 + 0; value = $4 + 0; if ((y < gutter || y >= 1024 - gutter) && value > 0) print $1 "," $2 }')
  horizontal_bleed=$(convert "$file" -alpha extract -scale 1024x4\! txt:- |
    awk -F '[,:()]' -v gutter="$gutter" 'NR > 1 { gsub(/ /, "", $1); gsub(/ /, "", $4); x = $1 + 0; value = $4 + 0; if ((x < gutter || x >= 1024 - gutter) && value > 0) print $1 "," $2 }')
  if [ -n "$vertical_bleed" ] || [ -n "$horizontal_bleed" ]; then
    echo "frame boundary bleed: $file"
    failed=1
  fi
done

exit "$failed"
