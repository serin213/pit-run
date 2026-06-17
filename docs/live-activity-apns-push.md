# Live Activity APNs Push (server-backed updates)

iOS Live Activity(Lock Screen / Dynamic Island)를 서버 APNs push로 갱신해 렌더
신뢰성을 높인다. **로컬 GPS/오디오 트리거 소유권은 바뀌지 않는다** — boxbox/fullPush/
finalLap/finish 사운드는 여전히 `src/platform/locationTask.ts`의 로컬 GPS 콜백이
단일 source다. APNs는 잠금/throttle 상황에서 화면 갱신을 보강할 뿐이다.

## 데이터 흐름

```
ActivityKit(.token) ──pushTokenUpdates──▶ 네이티브 onLiveActivityPushToken 이벤트
   (PitRunLiveActivityModule.swift)                      │
                                                         ▼
                              src/platform/liveActivity.ts (토큰 캐시 + MMKV 영속)
                                                         │ registerLiveActivityToken
                                                         ▼
                              src/api/liveActivityPush.ts ─▶ Supabase: live_activity_push_tokens

[boxbox/fullPush/regular 시점] locationTask.fireLAUpdate
   ├─ updateLiveActivity(...)            ← 로컬 Activity.update (1차, 항상 동작)
   └─ pushLiveActivityUpdate(...)        ← best-effort APNs 보강
          │ sendLiveActivityPush (supabase.functions.invoke)
          ▼
   supabase/functions/live-activity-push  ─▶ 토큰 조회 → ES256 JWT → APNs
          │ apns-push-type: liveactivity, apns-topic: com.pitrun.apps.push-type.liveactivity
          ▼
   Apple APNs ─▶ liveactivitiesd ─▶ Lock Screen / Dynamic Island 렌더
```

## 구성 요소

| 레이어 | 파일 |
| --- | --- |
| 네이티브 | `modules/pit-run-live-activity/ios/PitRunLiveActivityModule.swift` (`pushType: .token`, `pushTokenUpdates`, `frequentPushesEnabled`, `getPushToken`) |
| JS 브릿지 | `modules/pit-run-live-activity/src/index.ts` (`addPushTokenListener`, `getPushToken`, `frequentPushesEnabled`) |
| 플랫폼 | `src/platform/liveActivity.ts` (토큰 영속/등록/종료, `pushLiveActivityUpdate`) |
| 순수 로직 | `src/core/liveActivityPayload.ts` (content-state / priority / aps payload 빌더, 토스 미니앱 재사용 가능) |
| API | `src/api/liveActivityPush.ts` (register/end/send) |
| 스키마 | `supabase/migrations/0007_live_activity_push_tokens.sql` |
| 서버 | `supabase/functions/live-activity-push/index.ts` |

## 갱신 정책

- **일반 거리/타이머 표시**: 30–60초 cadence, `apns-priority: 5`.
- **boxbox / fullPush / finalLap / finish 시각 전환**: 즉시, `apns-priority: 10`.
- 로컬 `Activity.update`는 항상 폴백으로 유지된다.
- 로컬 사운드 타이밍은 APNs와 무관 (`playSound`는 `fireLAUpdate` 호출 전에 발화).

## 서버 시크릿 (배포 전 설정 필수)

```bash
supabase secrets set APNS_AUTH_KEY_P8="$(cat AuthKey_XXXX.p8)"
supabase secrets set APNS_KEY_ID=XXXXXXXXXX
supabase secrets set APNS_TEAM_ID=YYYYYYYYYY
supabase secrets set APNS_BUNDLE_ID=com.pitrun.apps
supabase secrets set APNS_ENV=production   # 또는 sandbox
supabase functions deploy live-activity-push
```

> `.p8` APNs auth key는 **절대 모바일 앱 번들에 넣지 않는다.** 서버 시크릿 전용.

마이그레이션 적용:

```bash
supabase db push   # 또는 supabase migration up
```

## 실기기 APNs 검증 절차

1. 실제 iPhone 또는 TestFlight 빌드로 설치 (시뮬레이터는 APNs push 미지원).
2. 레이스 시작 → 카운트다운에서 Live Activity 생성.
3. Xcode/Console.app 네이티브 로그에서 확인:
   - `[PitRunLA] activity REQUESTED OK (pushType=.token): id=...`
   - `[PitRunLA] pushToken update id=... token=<hex>`
4. Supabase `live_activity_push_tokens` 테이블에 row(status=active, push_token) 생성 확인.
5. 테스트 push 전송 (서버 함수 경유 또는 curl):

   ```bash
   curl -v -X POST "https://<project-ref>.functions.supabase.co/live-activity-push" \
     -H "Authorization: Bearer <user-access-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "activityId": "<activity-id>",
       "priority": 10,
       "event": "update",
       "contentState": {
         "distKm": 3.2, "elapsedMs": 600000, "paceS": 300,
         "sector": "red", "tire": "medium", "pitPhase": "boxbox",
         "prog": 0.45, "isPaused": false, "mode": "race",
         "timerStartMs": null, "timerEndMs": null
       }
     }'
   ```

   직접 APNs로 보낼 때 헤더: `apns-push-type: liveactivity`,
   `apns-topic: com.pitrun.apps.push-type.liveactivity`, `apns-priority: 10`,
   payload는 `aps.timestamp`(epoch s) / `aps.event` / `aps.content-state` 필수.
6. 앱을 백그라운드로 보내고 화면을 잠근 상태에서 push 전송.
7. Console.app에서 `liveactivitiesd`, `apsd`, `chronod` 프로세스 로그로 수신/렌더 확인.
8. 잠금화면 Live Activity가 push 내용대로 갱신되는지 육안 확인.

## content-state 일치 (중요)

APNs `aps.content-state`의 key는 `PitRunAttributes.ContentState`의 Swift 프로퍼티명과
**정확히 1:1(camelCase)** 이어야 한다. 어느 하나라도 추가/제거/리네임 시 세 곳을 동시에 수정:

- `modules/pit-run-live-activity/ios/PitRunLiveActivityModule.swift`
- Widget Extension의 `PitRunAttributes.swift`
- `src/core/liveActivityPayload.ts` (`LiveActivityContentState`)
