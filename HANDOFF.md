# 인수인계 — 컴퓨터 이전 (2026-08-31)

이전 맥에서 포맷 직전에 정리한 내용. **저장소·git log를 읽으면 알 수 있는 건 여기 안 적음.**
그것만으로는 알 수 없는 것, 그리고 밟기 쉬운 함정만 모았다.
프로젝트 규칙은 `CLAUDE.md`가 우선이고, 이 문서는 그 위의 현재 상황 메모다.

---

## 1. 새 컴퓨터 첫 세팅

`ios/` `android/`는 `.gitignore` 대상이라 저장소에 없다. `expo prebuild`로 생성한다.

    npm install          # postinstall 로 scripts/patch-apple-targets.js 자동 실행
    npx expo prebuild
    cd ios && pod install && cd ..
    npx tsc --noEmit && npm test    # 통과 기준: 에러 0, 테스트 113개 통과

저장소에 없어서 따로 옮긴 파일들(사용자가 별도 보관):

| 파일 | 없으면 생기는 일 |
| --- | --- |
| `.env` | `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` 없음 → Supabase 전부 실패 |
| `secrets/` 4개 | 로컬 서명 빌드·제출 불가 |
| `credentials.json` | EAS 로컬 credentials 참조 끊김 |

`.zshrc`에 `ASC_API_KEY_PATH`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `EXPO_APPLE_AUTH_METHOD=device`가
들어 있고 `~/.appstoreconnect/private_keys/AuthKey_33JU7R5JT4.p8`를 가리킨다.
`secrets/`의 같은 키를 그 경로에도 복사해야 EAS 빌드가 찾는다.

---

## 2. 지금 상태

main = **빌드 110**. 마지막 3개 커밋은 이전 작업 중 정리한 것:

    43aebed  feat(result): extract pace metrics to core, silence diag logs in release
    9664bd8  build(ios): bump to build 110, drop web platform, align SDK 55 deps
    48d40d8  chore: untrack build artifacts (.expo-export-test, .tmp)

커밋 시점에 타입체크 0 에러 / 테스트 113개 통과 확인함.
그 이전 실제 기능 작업은 `067bd2a`(2026-06-23)에서 멈춰 있었다. 약 2개월 공백.

롤백 지점: 태그 `pre-build110` → `067bd2a` (원격에 있음)

---

## 3. 저장소 함정

### ios/ 는 ignore인데 8개 파일만 강제 추적 중

    ios/PITRUN.xcodeproj/project.pbxproj
    ios/PITRUN/Info.plist
    ios/PITRUN/*.caf  (알림음 6개)

`.gitignore`에 `/ios`가 있어서 **`git add ios/...` 가 거부된다.** 반드시 `-f`:

    git add -f ios/PITRUN.xcodeproj/project.pbxproj

`git add -A ios ...` 같은 형태로 다른 경로와 묶으면 명령 전체가 실패하니 분리할 것.

### prebuild 가 추적 파일을 덮어쓴다

`npx expo prebuild`는 `ios/`를 재생성하므로 위 pbxproj / Info.plist도 다시 쓴다.
prebuild 후에는 **반드시 `git diff -- ios/` 를 확인**하고, 의도치 않은 변경이면 되돌릴 것.

### 빌드 번호는 두 곳이 짝

- `app.json` → `expo.ios.buildNumber`
- `ios/PITRUN.xcodeproj/project.pbxproj` → `CURRENT_PROJECT_VERSION`

`ios/PITRUN/Info.plist`의 `CFBundleVersion`은 하드코딩을 버리고
`$(CURRENT_PROJECT_VERSION)`을 읽도록 바꿔 놨다(9664bd8). 두 곳만 맞추면 된다.
`eas.json`의 production 프로필은 `autoIncrement: true` + `appVersionSource: local` 이라
EAS 빌드를 돌리면 EAS가 `app.json`을 직접 올린다. 로컬 Xcode 빌드로 올린 것과 어긋나기 쉬움.

### postinstall 이 node_modules 를 패치한다

`scripts/patch-apple-targets.js`가 `@bacons/apple-targets`의 widget 빌드 설정에서
`TARGETED_DEVICE_FAMILY`를 `"1"`(아이폰 전용)로 강제한다.
그 패키지가 업데이트되어 코드 모양이 바뀌면 스크립트가 **예외를 던지며 `npm install`이 실패**한다.
그때는 스크립트의 문자열 매칭을 새 버전에 맞춰 고칠 것.

`plugins/with-widget-object-version.js`는 pod install 이
`objectVersion 70` 호환 문자열을 못 찾아 깨지는 문제를 우회한다. 둘 다 지우면 위젯 빌드가 깨진다.

---

## 4. 빌드·배포 실제 사정

- **EAS**: `serinjang` 계정. 마지막 EAS 빌드는 #100 (2026-06-20).
- **빌드 101~110은 로컬 Xcode 아카이브**. EAS에는 기록이 없다.
- production 프로필은 `credentialsSource: local` → `secrets/` 파일을 직접 참조한다.

### Xcode Cloud 는 지금 항상 실패한다 (알고 둔 것)

App Store Connect에 워크플로 `Default / Archive - iOS`가 main 푸시마다 돈다. 그리고 매번:

    workspace PITRUN.xcworkspace does not exist at ios/PITRUN.xcworkspace

`/ios`가 최초 커밋부터 gitignore이고 `ci_scripts/ci_post_clone.sh`가 없어서,
클론한 상태엔 워크스페이스가 없다. **회귀가 아니라 처음부터 그랬다.**
사용자가 알면서 켜둔 상태이므로 main에 푸시하면 실패 메일이 온다. 놀라지 말 것.

고치려면 `ci_scripts/ci_post_clone.sh`에서 node·cocoapods 설치 → `npm ci` →
`expo prebuild` → `pod install` 을 하고, `EXPO_PUBLIC_SUPABASE_*`를
Xcode Cloud 환경변수로 등록해야 한다. 아직 안 함.

---

## 5. 브랜치 지형 — 대부분 죽은 가지다

로컬/원격 43개. **main 말고는 거의 다 오래된 실험이다.** 착각하기 쉬운 두 종류:

- `backup/stash-0` ~ `backup/stash-4`
  포맷 전 stash를 보존한 것. 일반 브랜치가 아니라 **stash 커밋**이라
  체크아웃하면 그 당시 작업 트리 상태가 나온다. 4~6월 실험이고 이어서 쓸 것은 아마 없다.

- `claude/*` 의 `wip:` 커밋들
  이전 직전에 워크트리 미커밋 변경을 **그대로 스냅샷만 뜬 것**이다.
  리뷰도 테스트도 안 거쳤다. 완성된 작업으로 취급하지 말 것.
  대부분 main보다 100~400 커밋 뒤처져 있어 그대로 머지하면 안 된다.

필요한 게 있으면 브랜치째 머지하지 말고 **해당 파일만 골라서 가져오는 편이 안전**하다.

---

## 6. 해결 안 된 것

1. **`CLAUDE.md` 5번 규칙과 코드가 어긋난다.**
   규칙은 네비게이션 호출을 `src/navigation/routes.ts`로 모으라고 하는데,
   그 파일은 `43aebed`에서 삭제됐다(참조하는 코드가 없어서). 타입체크는 통과한다.
   토스 미니앱 전환 시 라우트 호출부 격리가 필요하니, 규칙을 되살리든 문서를 고치든 정리 필요.

2. **Xcode Cloud** — 4번 참고.

3. **`~/pw-checker`** — 별개 프로젝트. 토스 미니앱 "비밀번호 안전도 체커"
   (Granite / `@apps-in-toss/framework`). **아직 git 저장소가 아니다.**
   pit-run과 같은 구조 원칙(`src/core`, `src/platform`, `src/api` 분리)을 따르고 있어서,
   pit-run의 core 로직을 미니앱으로 옮길 때 참고 사례가 된다. 저장소로 올리는 게 우선.

---

## 7. 정리하면서 확인한 것 (다시 안 해도 됨)

- 로컬 브랜치 43개 전부 원격에 푸시됨. 원격에 없는 커밋 0개.
- `assets-backup-20260517/`(28MB, 144개 파일)은 삭제했다.
  144개 전부 해시 대조로 git 히스토리에 이미 존재함을 확인한 뒤 지웠다.
  구버전 에셋이고, `control-buttons/inpit-*.png` 3개는
  `*-white.png`로 rename+재작업된 것이라 커밋 `b4a04f9`, `285c9ee`에 원본이 남아 있다.
- 웹 플랫폼 제거됨(`9664bd8`) — `react-dom`, `react-native-web`, web 스크립트 전부 삭제.
  `CLAUDE.md`대로 웹은 타깃이 아니니 되살리지 말 것.
