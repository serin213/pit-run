# Race Analytics

이벤트 기반 레이스 로깅 시스템. 현재는 `console.log` + AsyncStorage 큐 저장만 수행하며, 추후 백엔드 POST 엔드포인트 연동 예정.

## 통합 위치

### 1. 레이스 시작 (buildProgram 직후)
```ts
// e.g. SetupScreen or CountdownScreen
const program = buildProgram(user, circuit, tire);
const raceStartedEventId = await logRaceStarted({
  userId,
  grade,
  circuitId,
  tire,
  cyclePhase: program.cyclePhase,  // 'BASE' | 'BUILD' | 'PEAK' | 'RECOVERY'
  program,
});
// raceStartedEventId를 RunningScreen에 prop/store로 전달
```

### 2. 레이스 완주 (ResultScreen)
```ts
const raceCompletedEventId = await logRaceCompleted({
  raceStartedEventId,   // logRaceStarted가 반환한 id
  userId,
  completedReps,
  actualHardPace,       // 실제 평균 pace (sec/km)
  actualEasyPace,       // walk 모드면 null
  totalDurationSec,
});
// raceCompletedEventId를 피드백 화면에 전달
```

### 3. 레이스 중 Retire (RunningScreen retire 버튼)
```ts
await logRaceAbandoned({
  raceStartedEventId,
  userId,
  abandonedAtRep,   // 1-indexed: 몇 번째 인터벌에서 그만뒀는지
  reasonCode: 'user_quit',
});
```

### 4. 레이스 결과 피드백 (ResultScreen 또는 별도 피드백 화면)
```ts
await logRaceFeedback({
  raceCompletedEventId,
  userId,
  feedback: 'just_right',  // 'too_easy' | 'just_right' | 'too_hard'
});
```

## 큐 플러시 (백엔드 연동 후)
```ts
const pending = await getPendingEvents();
// POST /api/events 로 전송
const successIds = pending.map(e => e.eventId);
await clearPendingEvents(successIds);
```
