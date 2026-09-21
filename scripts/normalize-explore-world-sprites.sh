#!/bin/sh
set -eu

asset_dir=${1:-games/explore-world/assets/characters}
source_dir=${2:-$asset_dir}
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
  width=$(identify -format '%w' "$source")
  height=$(identify -format '%h' "$source")
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

  if [ "$width" -eq 615 ]; then
    # The four source poses in the 615px sheets are wider than their nominal
    # 153.75px cells. These boundaries sit in the transparent gaps between
    # silhouettes; equal-width cuts would retain neighboring limbs.
    x_cuts="0 185 313 448 615"
  else
    x_cuts="0 $((width / 4)) $((width / 2)) $((width * 3 / 4)) $width"
  fi

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
      flip=""
      if [ "$source_rows" -eq 3 ] && [ "$row_index" -eq 2 ]; then flip='-flop'; fi
      convert "$source" -crop "${cell_width}x${row_height}+${left}+${row_start}" +repage $flip \
        -trim +repage -resize '224x224' -gravity center -background none -extent 256x256 "$frame"
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

for entry in \
  'mother:4' 'father:4' 'grandfather:3' 'grandmother:3' \
  'brother:4' 'duty-teacher:4' 'lin-teacher:3' 'student-1:3' \
  'student-2:4' 'student-3:4' 'student-4:3' 'student-5:3' \
  'student-6:4' 'student-7:4' 'student-8:3' 'student-9:3' \
  'student-10:4' 'guide-nurse:4' 'chen-nurse:3' 'wang-doctor:3' \
  'patient-1:4' 'patient-2:4' 'patient-3:3' 'patient-4:3' \
  'player:4' 'cashier:4' 'stock-clerk:4' 'floor-clerk:4' \
  'customer-1:4' 'customer-2:4' 'customer-3:4' 'customer-4:4'; do
  name=${entry%:*}
  rows=${entry#*:}
  source="$source_dir/$name.png"
  output="$tmp_dir/$name-normalized.png"
  normalize_sheet "$source" "$output" "$rows"
  mv "$output" "$asset_dir/$name.png"
done
