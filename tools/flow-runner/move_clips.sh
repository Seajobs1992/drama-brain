#!/bin/bash
# Moves finished clips, frames and reports from Chrome's download folder into the LOCKED OUT project.
# Usage: move_clips.sh [hours]   (default 4). Checks every 20 seconds.
# On another computer set the two folders first:
#   FLOW_DOWNLOADS="<Chrome's download folder>/LOCKED-OUT" MOVIE_DIR="<movie folder>" ./move_clips.sh
SRC="${FLOW_DOWNLOADS:-/Volumes/MUSIC/Apothecarys Ledger/episode 1 video /LOCKED-OUT}"
DST="${MOVIE_DIR:-/Volumes/MAC/NEW DRAM}/production"
end=$(( $(date +%s) + ${1:-4}*3600 ))
while [ $(date +%s) -lt $end ]; do
  /usr/bin/find "$SRC" -type f \( -name "*.mp4" -o -name "*.jpg" -o -name "*.png" -o -name "*.json" \) ! -name "._*" 2>/dev/null | while read -r f; do
    age=$(( $(date +%s) - $(stat -f %m "$f") ))
    [ "$age" -lt 15 ] && continue   # Chrome may still be writing it
    rel="${f#$SRC/}"            # EP02/clips/2-03.mp4
    out="$DST/$rel"
    mkdir -p "$(dirname "$out")"
    if [ -e "$out" ] && ! cmp -s "$f" "$out"; then
      base="${out%.mp4}"; n=1; while [ -e "$base take$((n+1)).mp4" ]; do n=$((n+1)); done; out="$base take$((n+1)).mp4"
    fi
    cp -p "$f" "$out" && cmp -s "$f" "$out" && rm -f "$f" "$(dirname "$f")/._$(basename "$f")" && echo "$(date +%H:%M:%S) moved $rel -> ${out#$DST/}"
  done
  sleep 20
done
