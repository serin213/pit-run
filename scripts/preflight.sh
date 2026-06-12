#!/bin/bash
# PIT RUN — 빌드 전 게이트 검증 스크립트
# 하나라도 실패 시 exit 1. 빌드 시작 전 실행 권장.
set -euo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"  # 0=pass, 1=fail
  local detail="$3"
  if [ "$result" -eq 0 ]; then
    echo "✅ $label"
    PASS=$((PASS + 1))
  else
    echo "❌ $label: $detail"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== PIT RUN preflight ==="

# ① .env Supabase URL에 올바른 ref 포함 확인
if grep -q "jrfgwosjwjpexikczzua" .env 2>/dev/null; then
  check "Supabase URL ref" 0 ""
else
  check "Supabase URL ref" 1 ".env에 jrfgwosjwjpexikczzua 없음 — .env 확인 필요"
fi

# ② app.json buildNumber 출력
BUILD_NUM=$(python3 -c "import json; d=json.load(open('app.json')); print(d['expo']['ios']['buildNumber'])" 2>/dev/null || echo "read error")
echo "ℹ️  buildNumber: $BUILD_NUM"

# ③ ios/build/generated ReactCodegen 산출물 존재 확인
if [ -d "ios/build/generated/ios/ReactCodegen" ]; then
  check "ReactCodegen 산출물" 0 ""
else
  check "ReactCodegen 산출물" 1 "ios/build/generated/ios/ReactCodegen 없음 — 재생성 필요:
       node node_modules/react-native/scripts/generate-codegen-artifacts.js -p . -t ios -o ."
fi

# ④ entitlements에 applesignin + app-groups 존재
ENTITLEMENTS="ios/PITRUN/PITRUN.entitlements"
if [ -f "$ENTITLEMENTS" ]; then
  APPLE_SIGN=$(grep -c "applesignin" "$ENTITLEMENTS" 2>/dev/null || echo 0)
  APP_GROUPS=$(grep -c "application-groups" "$ENTITLEMENTS" 2>/dev/null || echo 0)
  if [ "$APPLE_SIGN" -gt 0 ] && [ "$APP_GROUPS" -gt 0 ]; then
    check "Entitlements (applesignin + app-groups)" 0 ""
  else
    check "Entitlements (applesignin + app-groups)" 1 "applesignin=$APPLE_SIGN, app-groups=$APP_GROUPS"
  fi
else
  check "Entitlements 파일 존재" 1 "$ENTITLEMENTS 없음"
fi

echo ""
echo "=== 결과: ${PASS} PASS / ${FAIL} FAIL ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
