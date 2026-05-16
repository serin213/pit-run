#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# bash 3.2 호환: 연관배열 대신 함수로 캡 결정
get_cap_for_file() {
  local f="$1"

  # 단일 파일 캡
  case "$f" in
    "assets/race-flag.png")            echo 500; return ;;
    "assets/race-trophy.png")          echo 500; return ;;
    "assets/practice-race-flag.png")   echo 500; return ;;
    "assets/qualifying-card-trophy.png") echo 600; return ;;
    "assets/qualifying/globe.png")     echo 800; return ;;
    "assets/qualifying/history-f1-champion.png") echo 400; return ;;
    "assets/qualifying/history-f1-rookie.png")   echo 400; return ;;
    "assets/qualifying/history-f1.png") echo 400; return ;;
    "assets/qualifying/history-f2.png") echo 400; return ;;
    "assets/qualifying/history-f3.png") echo 400; return ;;
    "assets/f1-champion.png")          echo 600; return ;;
    "assets/f1-rookie.png")            echo 600; return ;;
    "assets/f1.png")                   echo 600; return ;;
    "assets/f2.png")                   echo 600; return ;;
    "assets/f3.png")                   echo 600; return ;;
  esac

  # 폴더별 캡
  case "$f" in
    assets/icons/*)                    echo 400; return ;;
    assets/qualifying/trophy/*)        echo 450; return ;;
    assets/qualifying/f1-champion/*)   echo 450; return ;;
    assets/qualifying/f1-rookie/*)     echo 450; return ;;
    assets/qualifying/f1/*)            echo 450; return ;;
    assets/qualifying/f2/*)            echo 450; return ;;
    assets/qualifying/f3/*)            echo 450; return ;;
    assets/qualifying/text/*)          echo 600; return ;;
    assets/qualifying/history/*)       echo 400; return ;;
    assets/circuits/*)                 echo 600; return ;;
    assets/flags/*)                    echo 600; return ;;
    assets/control-buttons/*)          echo 400; return ;;
  esac

  echo "600"  # default
}

is_excluded() {
  local f="$1"
  case "$f" in
    *assets/lottie*|*assets/countdown*|*assets/icon.png*|\
    *assets/android-icon-foreground.png*|*assets/splash*)
      return 0 ;;
  esac
  return 1
}

TOTAL_BEFORE=0
TOTAL_AFTER=0
PROCESSED=0
SKIPPED=0

while IFS= read -r -d '' file; do
  if is_excluded "$file"; then
    continue
  fi

  size_before=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  TOTAL_BEFORE=$((TOTAL_BEFORE + size_before))

  # 작은 파일(20KB 이하)은 스킵
  if [[ $size_before -lt 20480 ]]; then
    SKIPPED=$((SKIPPED + 1))
    TOTAL_AFTER=$((TOTAL_AFTER + size_before))
    continue
  fi

  cap=$(get_cap_for_file "$file")
  dims=$(magick identify -format "%w %h" "$file")
  w=$(echo "$dims" | cut -d' ' -f1)
  h=$(echo "$dims" | cut -d' ' -f2)
  long_edge=$(( w > h ? w : h ))

  # 리사이즈 (필요시)
  if [[ $long_edge -gt $cap ]]; then
    magick "$file" -resize "${cap}x${cap}>" -strip "$file"
  fi

  # pngquant 압축 (lossy, 70-90% quality)
  pngquant --quality=70-90 --strip --skip-if-larger --force --output "$file" "$file" || true

  size_after=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  TOTAL_AFTER=$((TOTAL_AFTER + size_after))
  PROCESSED=$((PROCESSED + 1))

  reduction=$(( (size_before - size_after) * 100 / size_before ))
  echo "✓ $file: $((size_before/1024))KB → $((size_after/1024))KB (-${reduction}%)"
done < <(find assets -name "*.png" -print0)

echo ""
echo "═══════════════════════════════════════"
echo "처리 완료: ${PROCESSED}개 파일, ${SKIPPED}개 스킵"
echo "총합: $((TOTAL_BEFORE/1024/1024))MB → $((TOTAL_AFTER/1024/1024))MB"
echo "감소율: $(( (TOTAL_BEFORE - TOTAL_AFTER) * 100 / TOTAL_BEFORE ))%"
