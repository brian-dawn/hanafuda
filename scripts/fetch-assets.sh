#!/usr/bin/env bash
# Fetch 48 Hanafuda card SVGs from Wikimedia Commons.
# Each file lands at assets/cards/<id>.svg where <id> = (month-1)*4 + sub (0..47).
# Also writes assets/CREDITS.md.

set -u  # don't set -e: we want to report all failures

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/assets/cards"
CREDITS="$HERE/assets/CREDITS.md"
mkdir -p "$OUT"

BASE="https://commons.wikimedia.org/wiki/Special:FilePath"

# id:filename pairs. id = (month-1)*4 + sub.
FILES=(
  # January - Pine & Crane
  "0:Hanafuda_January_Hikari_Alt.svg"
  "1:Hanafuda_January_Tanzaku_Alt.svg"
  "2:Hanafuda_January_Kasu_1_Alt.svg"
  "3:Hanafuda_January_Kasu_2_Alt.svg"
  # February - Plum Blossom & Bush Warbler
  "4:Hanafuda_February_Tane_Alt.svg"
  "5:Hanafuda_February_Tanzaku_Alt.svg"
  "6:Hanafuda_February_Kasu_1_Alt.svg"
  "7:Hanafuda_February_Kasu_2_Alt.svg"
  # March - Cherry Blossom & Curtain
  "8:Hanafuda_March_Hikari_Alt.svg"
  "9:Hanafuda_March_Tanzaku_Alt.svg"
  "10:Hanafuda_March_Kasu_1_Alt.svg"
  "11:Hanafuda_March_Kasu_2_Alt.svg"
  # April - Wisteria & Cuckoo
  "12:Hanafuda_April_Tane_Alt.svg"
  "13:Hanafuda_April_Tanzaku_Alt.svg"
  "14:Hanafuda_April_Kasu_1_Alt.svg"
  "15:Hanafuda_April_Kasu_2_Alt.svg"
  # May - Iris & Bridge
  "16:Hanafuda_May_Tane_Alt.svg"
  "17:Hanafuda_May_Tanzaku_Alt.svg"
  "18:Hanafuda_May_Kasu_1_Alt.svg"
  "19:Hanafuda_May_Kasu_2_Alt.svg"
  # June - Peony & Butterflies
  "20:Hanafuda_June_Tane_Alt.svg"
  "21:Hanafuda_June_Tanzaku_Alt.svg"
  "22:Hanafuda_June_Kasu_1_Alt.svg"
  "23:Hanafuda_June_Kasu_2_Alt.svg"
  # July - Bush Clover & Boar
  "24:Hanafuda_July_Tane_Alt.svg"
  "25:Hanafuda_July_Tanzaku_Alt.svg"
  "26:Hanafuda_July_Kasu_1_Alt.svg"
  "27:Hanafuda_July_Kasu_2_Alt.svg"
  # August - Pampas Grass, Moon & Geese
  "28:Hanafuda_August_Hikari_Alt.svg"
  "29:Hanafuda_August_Tane_Alt.svg"
  "30:Hanafuda_August_Kasu_1_Alt.svg"
  "31:Hanafuda_August_Kasu_2_Alt.svg"
  # September - Chrysanthemum & Sake Cup
  "32:Hanafuda_September_Tane_Alt.svg"
  "33:Hanafuda_September_Tanzaku_Alt.svg"
  "34:Hanafuda_September_Kasu_1_Alt.svg"
  "35:Hanafuda_September_Kasu_2_Alt.svg"
  # October - Maple & Deer
  "36:Hanafuda_October_Tane_Alt.svg"
  "37:Hanafuda_October_Tanzaku_Alt.svg"
  "38:Hanafuda_October_Kasu_1_Alt.svg"
  "39:Hanafuda_October_Kasu_2_Alt.svg"
  # November - Willow, Rain Man, Swallow, Lightning
  "40:Hanafuda_November_Hikari_Alt.svg"
  "41:Hanafuda_November_Tane_Alt.svg"
  "42:Hanafuda_November_Tanzaku_Alt.svg"
  "43:Hanafuda_November_Kasu_Alt.svg"
  # December - Paulownia & Phoenix
  "44:Hanafuda_December_Hikari_Alt.svg"
  "45:Hanafuda_December_Kasu_1_Alt.svg"
  "46:Hanafuda_December_Kasu_2_Alt.svg"
  "47:Hanafuda_December_Kasu_3_Alt.svg"
)

UA="KoiKoiWebDemo/0.1 (https://github.com/localhost; scratch-project) curl"

echo "Fetching ${#FILES[@]} cards into $OUT"
fails=0

{
  echo "# Hanafuda card image credits"
  echo
  echo "All card images are SVG files from Wikimedia Commons, category"
  echo "[SVG Hanafuda with traditional colors (black border)]"
  echo "(https://commons.wikimedia.org/wiki/Category:SVG_Hanafuda_with_traditional_colors_(black_border))."
  echo
  echo "License: the underlying card designs are in the public domain"
  echo "(2D reproductions of pre-1900 Japanese art). Individual SVG files"
  echo "on Commons carry their own licenses — most are CC BY-SA 4.0 or PD."
  echo "Check each source page for the authoritative license."
  echo
  echo "| id | file | source |"
  echo "|---:|:-----|:-------|"
} > "$CREDITS"

for pair in "${FILES[@]}"; do
  id="${pair%%:*}"
  file="${pair#*:}"
  url="$BASE/$file"
  out="$OUT/$id.svg"

  # Retry with backoff on 429 / transient failures.
  attempt=0
  while :; do
    code=$(curl -sL -A "$UA" -o "$out" -w "%{http_code}" "$url")
    size=$(wc -c < "$out" | tr -d ' ')
    if [[ "$code" == "200" ]] && [[ "$size" -gt 1000 ]]; then
      printf "ok   id=%-4s file=%s (%d bytes)\n" "$id" "$file" "$size"
      break
    fi
    attempt=$((attempt+1))
    if [[ $attempt -ge 4 ]]; then
      echo "FAIL id=$id file=$file http=$code size=$size (gave up after $attempt tries)"
      fails=$((fails+1))
      break
    fi
    delay=$((attempt * 3))
    echo "retry id=$id http=$code size=$size attempt=$attempt sleeping ${delay}s"
    sleep $delay
  done

  # Light throttle between requests to be polite to Wikimedia.
  sleep 0.3

  page="https://commons.wikimedia.org/wiki/File:$file"
  echo "| $id | \`$file\` | [page]($page) |" >> "$CREDITS"
done

echo
if [[ $fails -eq 0 ]]; then
  echo "All files fetched successfully."
else
  echo "$fails file(s) failed — game will fall back to placeholder rendering for those."
  exit 1
fi
