# Project Guidelines

## Target Platform
- Target: iOS and Android (App Store / Play Store distribution)
- Web is NOT a target platform — do not use it as a QA reference
- All implementation must be verified on native iOS simulator or Android emulator
- **Secondary target (planned 6월 launch): Toss 미니앱 (앱인토스 / Granite framework)** — every new feature must be structured so it can run in the Granite environment with minimal rework

## Styling Rules
- When iOS and Android behave differently (shadows, fonts, blur, overflow, etc.), use `Platform.OS` to branch
- Never assume web-compatible CSS behavior applies to native

## Stack
- React Native / Expo (native app)
- Granite / `@apps-in-toss/framework` (Toss mini-app, planned)
- TypeScript
- Supabase (auth + DB)

## Toss 미니앱 호환 설계 원칙 (REQUIRED)

모든 신규 개발은 토스 미니앱 재사용을 염두에 두고 다음 원칙을 지킬 것.

### 1. 플랫폼 호출은 반드시 래퍼 경유 (`src/platform/`)
- 스크린·훅에서 `expo-*` 패키지를 **직접 import 금지**
- 모든 네이티브 호출은 `src/platform/` 아래 추상화된 인터페이스로만 사용
- 대상: location, notifications, haptics, keep-awake, auth, storage 등
- 이유: 미니앱 전환 시 이 파일들만 토스 SDK로 교체

### 2. 비즈니스 로직은 순수 함수로 분리 (`src/core/`)
- 계산·알고리즘(인터벌 프로그래밍, 등급 계산, 페이스 계산, 거리 집계)은 React/RN import 없는 순수 TS 함수
- 스크린 JSX 내부에 로직 작성 금지 — 훅/핸들러에서 core 함수 호출만
- 이유: 미니앱에서 그대로 import 해서 재사용

### 3. API 레이어 격리 (`src/api/`)
- Supabase 호출을 스크린에서 직접 하지 말고 `src/api/` 함수로 래핑
- 훅(`useProfile`, `useRunSessions` 등)으로 소비, 훅 내부에서만 api 호출
- 이유: 미니앱과 네이티브가 동일한 API 코드 공유

### 4. 도메인 타입은 `src/types/`
- `QualifyingResult`, `UserProfile`, `RunSession` 등 모든 도메인 타입을 여기에
- React 의존 금지, 순수 TS만
- 스크린·스토어·컴포넌트에서 로컬 재정의 금지

### 5. 네비게이션 분기점 격리 (`src/navigation/routes.ts`)
- `navigation.navigate('Foo')` 를 스크린 여기저기에 흩어놓지 말고 `routes.toFoo(navigation)` 식으로 모으기
- 이유: 미니앱은 Granite 파일 기반 라우팅이라 라우트 호출부만 교체하면 됨

### 6. 스크린/컴포넌트 UI는 최대한 공유 가능하게
- Native 전용 요소(탭바, 네비게이션 헤더, 네이티브 모달)는 스크린 최상위에서 격리
- 스크린 본문은 순수 UI(JSX + style)로 작성해 미니앱에서 재사용 가능하도록

### 7. 피해야 할 것
- react-navigation과 깊게 결합된 서드파티 라이브러리
- Expo-only 런타임 API (대체재 있으면 우선)
- 네이티브 모듈 많이 쓰는 미검증 서드파티 — 미니앱 호환 불확실

### 8. 이메일 기반 사용자 매칭
- Native: Apple/Google 로그인 → Supabase Auth
- 미니앱: 토스 로그인 → 이메일 매칭으로 동일 Supabase 사용자와 연결
- 로그인 구현 시 동일 이메일 소유자는 같은 계정으로 처리

### 9. 백그라운드 GPS vs 화면 유지
- Native: 백그라운드 GPS 사용 (expo-task-manager + UIBackgroundModes)
- 미니앱: 화면 유지 SDK 사용 (토스 제공)
- 두 구현 모두 `src/platform/location.ts` 인터페이스 뒤에서 처리

### 10. 장기: Monorepo 전환 예정
- 5월 정식 출시 후 `packages/core`, `packages/api`, `packages/types` 로 분리 예정
- 지금 구조를 지키면 그때 `git mv` 만으로 이동 가능
