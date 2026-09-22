#!/bin/sh
set -eu

asset_dir=${1:-games/explore-world/assets/characters}
source_dir=${2:-$asset_dir}
only=${ONLY:-}
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

# The generated source sheets have transparent valleys between poses, but the
# valleys are not on a fixed grid. Find the safest cut near each expected row
# boundary, then repack every pose into a strict 256x256 cell.
find_cut() {
  density_file=$1
  height=$2
  rows=$3
  boundary=$4
  target=$((boundary * height / rows))
  span=$((height / (rows * 3)))
  awk -v target="$target" -v span="$span" '
    $1 >= target - span && $1 <= target + span {
      if (!found || $2 < best) { found = 1; best = $2; line = $1 }
    }
    END { if (!found) exit 1; print line }
  ' "$density_file"
}

normalize_sheet() {
  source=$1
  output=$2
  source_rows=$3
  crop_y=$4
  crop_height=$5
  width=$(identify -format '%w' "$source")
  height=$(identify -format '%h' "$source")
  if [ "$crop_y" -gt 0 ] || [ "$crop_height" -gt 0 ]; then
    if [ "$crop_height" -eq 0 ]; then crop_height=$((height - crop_y)); fi
    cropped_source="$tmp_dir/$(basename "$source").cropped.png"
    convert "$source" -crop "${width}x${crop_height}+0+${crop_y}" +repage "$cropped_source"
    source=$cropped_source
    height=$(identify -format '%h' "$source")
  fi
  y_density="$tmp_dir/$(basename "$source").y-density"
  x_density="$tmp_dir/$(basename "$source").x-density"
  convert "$source" -alpha extract -scale 1x"$height"\! txt:- |
    awk -F '[,:()]' 'NR > 1 { gsub(/ /, "", $2); gsub(/ /, "", $4); print $2, $4 }' > "$y_density"
  convert "$source" -alpha extract -scale "$width"x1\! txt:- |
    awk -F '[,:()]' 'NR > 1 { gsub(/ /, "", $1); gsub(/ /, "", $4); print $1, $4 }' > "$x_density"

  cuts="0"
  boundary=1
  while [ "$boundary" -lt "$source_rows" ]; do
    cuts="$cuts $(find_cut "$y_density" "$height" "$source_rows" "$boundary")"
    boundary=$((boundary + 1))
  done
  cuts="$cuts $height"

  # Locate each column boundary in an alpha valley. The generated poses are
  # wider than nominal grid cells, and a single hard-coded set of cuts lets
  # neighboring hands, hair, or clothing leak into some characters.
  x_cuts="0"
  boundary=1
  while [ "$boundary" -lt 4 ]; do
    x_cuts="$x_cuts $(find_cut "$x_density" "$width" 4 "$boundary")"
    boundary=$((boundary + 1))
  done
  x_cuts="$x_cuts $width"

  old_ifs=$IFS
  IFS=' '
  set -- $cuts
  IFS=$old_ifs
  cut0=$1
  cut1=$2
  cut2=$3
  cut3=$4
  cut4=${5:-$4}
  old_ifs=$IFS
  IFS=' '
  set -- $x_cuts
  IFS=$old_ifs
  xcut0=$1
  xcut1=$2
  xcut2=$3
  xcut3=$4
  xcut4=$5
  row_index=0
  rows_out=""
  while [ "$row_index" -lt 4 ]; do
    if [ "$source_rows" -eq 3 ] && [ "$row_index" -eq 2 ]; then
      row_start=$cut1
      row_end=$cut2
      source_row=1
    elif [ "$source_rows" -eq 3 ] && [ "$row_index" -eq 3 ]; then
      row_start=$cut2
      row_end=$cut3
      source_row=2
    elif [ "$row_index" -eq 0 ]; then
      row_start=$cut0
      row_end=$cut1
      source_row=0
    elif [ "$row_index" -eq 1 ]; then
      row_start=$cut1
      row_end=$cut2
      source_row=1
    elif [ "$row_index" -eq 2 ]; then
      row_start=$cut2
      row_end=$cut3
      source_row=2
    else
      row_start=$cut3
      row_end=$cut4
      source_row=3
    fi
    row_height=$((row_end - row_start))
    row_cells=""
    column=0
    while [ "$column" -lt 4 ]; do
      if [ "$column" -eq 0 ]; then left=$xcut0; right=$xcut1
      elif [ "$column" -eq 1 ]; then left=$xcut1; right=$xcut2
      elif [ "$column" -eq 2 ]; then left=$xcut2; right=$xcut3
      else left=$xcut3; right=$xcut4
      fi
      cell_width=$((right - left))
      frame="$tmp_dir/frame-${row_index}-${column}.png"
      alpha="$tmp_dir/frame-${row_index}-${column}.alpha.png"
      mask="$tmp_dir/frame-${row_index}-${column}.mask.png"
      clean_alpha="$tmp_dir/frame-${row_index}-${column}.clean-alpha.png"
      clean_frame="$tmp_dir/frame-${row_index}-${column}.clean.png"
      flip=""
      if [ "$source_rows" -eq 3 ] && [ "$row_index" -eq 2 ]; then flip='-flop'; fi
      convert "$source" -crop "${cell_width}x${row_height}+${left}+${row_start}" +repage $flip \
        -trim +repage -resize '224x224' -gravity center -background none -extent 256x256 \
        -shave 12x12 -bordercolor none -border 12 "$frame"
      # Keep the original antialiased alpha, but use a binary morphology mask
      # to remove isolated pixels left by neighboring poses in the composite.
      convert "$frame" -alpha extract "$alpha"
      convert "$alpha" -threshold 1% -morphology Open Disk:1 "$mask"
      convert "$alpha" "$mask" -compose Multiply -composite "$clean_alpha"
      convert "$frame" -alpha off "$clean_alpha" -compose CopyOpacity -composite "$clean_frame"
      mv "$clean_frame" "$frame"
      row_cells="$row_cells $frame"
      column=$((column + 1))
    done
    row_file="$tmp_dir/row-${row_index}.png"
    convert $row_cells +append "$row_file"
    rows_out="$rows_out $row_file"
    row_start=$row_end
    row_index=$((row_index + 1))
  done
  convert $rows_out -append "$output"
}

# Entries use name:source_rows:crop_y:crop_height. The school source sheets
# contain three poses except for the four-row duty-teacher sheet; the explicit
# crop offsets remove overlap from the neighboring panels in the old composite.
for entry in \
  'mother:4:0:0' 'father:4:0:0' 'grandfather:3:0:0' 'grandmother:3:0:0' \
  'brother:4:0:0' 'duty-teacher:4:0:0' 'lin-teacher:3:60:0' 'student-1:3:60:0' \
  'student-2:3:0:585' 'student-3:3:0:585' 'student-4:3:0:0' 'student-5:3:0:0' \
  'student-6:3:0:0' 'student-7:3:0:0' 'student-8:3:0:0' 'student-9:3:0:0' \
  'student-10:3:0:0' 'guide-nurse:3:0:0' 'chen-nurse:3:0:0' 'wang-doctor:3:0:0' \
  'patient-1:3:0:0' 'patient-2:3:0:0' 'patient-3:3:0:0' 'patient-4:3:0:0' \
  'player:4:0:0' 'cashier:4:0:0' 'stock-clerk:4:0:0' 'floor-clerk:4:0:0' \
  'customer-1:4:0:0' 'customer-2:4:0:0' 'customer-3:4:0:0' 'customer-4:4:0:0'; do
  name=${entry%%:*}
  if [ -n "$only" ] && ! printf '%s\n' ",$only," | grep -q ",$name,"; then
    continue
  fi
  metadata=${entry#*:}
  rows=${metadata%%:*}
  metadata=${metadata#*:}
  crop_y=${metadata%%:*}
  crop_height=${metadata#*:}
  source="$source_dir/$name.png"
  output="$tmp_dir/$name-normalized.png"
  normalize_sheet "$source" "$output" "$rows" "$crop_y" "$crop_height"
  mv "$output" "$asset_dir/$name.png"
done
