/**
 * GPS 진단 카운터 — 모듈 레벨 mutable 객체.
 *
 * useGPS hook + locationTask 양쪽이 update, QualifyingScreen overlay가 read.
 * 빌드 42에선 useGPS.ts에 두었는데 locationTask.ts와 순환 import 발생 → 별도
 * 파일로 분리. import 그래프: useGPS → gpsDiag, locationTask → gpsDiag,
 * QualifyingScreen → gpsDiag. 단방향.
 *
 * production iOS에서 console.log가 OSLog로 흐르지 않는 케이스 대비. 화면
 * overlay에서 500ms force-render로 실시간 표시.
 */

// ── 콜백 타임스탬프 링버퍼 (A/B 계측용) ──────────────────────────────────────
export type CbLogEntry = { t: number; k: 'cb' | 'fg' | 'bg' };
export const cbLog: CbLogEntry[] = [];
export function pushCbLog(k: CbLogEntry['k']): void {
  cbLog.push({ t: Date.now(), k });
  if (cbLog.length > 60) cbLog.shift();
}

export const gpsDiag = {
  // useGPS hook
  enabled: false as boolean,
  fgPerm: null as boolean | null,
  bgPerm: null as boolean | null,
  tick: 0,
  nullCount: 0,
  accSkipCount: 0,
  distSkipCount: 0,
  acceptCount: 0,
  lastAccuracy: null as number | null,
  lastDist: null as number | null,
  totalAccumulatedKm: 0,
  cleanupCount: 0,

  // locationTask: defineBackgroundLocationTask + start
  defineCalled: false as boolean,
  defineError: '' as string,
  // index.ts에서 defineBackgroundLocationTask 호출 직후 isTaskRegisteredAsync 결과
  earlyReg: null as boolean | null,
  earlyRegError: '' as string,
  // index.ts에서 getRegisteredTasksAsync로 등록된 task 이름들 확인
  earlyRegTasks: '' as string,
  // useGPS effect에서 startBackgroundLocationTask 직전 isTaskRegisteredAsync 결과
  taskRegistered: null as boolean | null,
  taskStarted: null as boolean | null,
  // 빌드 44에서 가드 우회 시도 — isRegistered=false여도 startLocationUpdatesAsync 직접 호출
  startBypassed: false as boolean,
  startResolved: null as boolean | null,
  taskWriteCount: 0,
  lastTaskWriteTs: 0,
  startError: '' as string,

  // CLBackgroundActivitySession 상태 (FIX 7-2)
  bgSessionActive: false as boolean,

  // FIX 10-A: ghost-proof start — pre-stop 실행 횟수
  ghostCleared: 0,

  // maybeFireBackgroundRaceEvents 가드 진단 — FIX 4
  bgEventCallCount: 0,
  bgEventPlanNull: 0,
  // 분기별 카운터 — 잠금 중 사운드 미발화 원인 진단용
  bgEventQualifying: 0,
  bgEventFullPushFired: 0,
  bgEventBoxBoxFired: 0,
  bgEventWorkNotReady: 0,
  bgEventNotWorkPhase: 0,

  // FIX 12: 잠금 중 콜백 검증 카운터 (AppState !== 'active' 시 task 콜백 진입 횟수).
  // 잠금 60초 후 ~60이면 distanceFilter 제거로 백그라운드 정지 해결 확정.
  bgTw: 0,
  // 잠금 중 LA push 검증 (background 상태에서 시도/성공 수 분리)
  bgLaTried: 0,
  bgLaOk: 0,

  // FIX 13-2B: 잠금 진입/해제 시점의 누적 거리(km) 기록 — 잠금 중 거리 누적 검증용.
  lockEnterKm: null as number | null,
  lockExitKm: null as number | null,
};

export const laDiag = {
  pushTried: 0,
  pushOk: 0,
  pushFail: 0,
  nativeMiss: 0,
  lastPushAt: 0,           // timestamp (Date.now())
  lastPushDistKm: null as number | null,
  lastPushWasBg: false,
  lastErrorMsg: '',
  lockTransitions: 0,      // 잠금/언락 transition 횟수
  lastLockState: 'active', // 'active' | 'background' | 'inactive'
  // foreground(active) 실시간 LA push 횟수 (useRunning syncFromPlan, 1초 cadence).
  // background fireLAUpdate 횟수는 gpsDiag.bgLaOk가 담당 → fg/bg 소스 분리 검증.
  fgLaPush: 0,
};

/**
 * 엔진음 keep-alive + 시간기준 box-box 계측.
 * 핵심: 루프-생존(active/playing/restartCount) — 엔진이 죽으면 옛 버그(잠금 중 멈춤)와
 * 똑같이 보이므로 반드시 가시화해야 원인 구분이 된다.
 */
export const engineDiag = {
  // ── 루프-생존 ──────────────────────────────────────────────────────────────
  active: false,            // 재생 "의도" (race 진행 중 + 토글 ON)
  playing: false,           // 실제 재생 중 (마지막 폴링 값)
  restartCount: 0,          // 워치독/네이티브 이벤트로 되살린 횟수 (0이면 한 번도 안 죽음)
  startedAtMs: 0,           // 엔진 루프 시작 시각
  // ── 인터럽션 (네이티브 AVAudioSession 이벤트) ────────────────────────────────
  interruptionCount: 0,
  lastInterruptionAtMs: 0,
  lastInterruptionKind: '' as string, // 'began'|'ended'|'ended-resume'|'route:xxx'|'mediaReset'
  lastInterruptionDurationMs: null as number | null, // began→ended 간격
  // ── box-box/풀푸시 정시성 (예약 vs 실제 발화) ───────────────────────────────
  lastBoxBoxDeltaMs: null as number | null,
  maxBoxBoxDeltaMs: 0,
  lastFullPushDeltaMs: null as number | null,
  maxFullPushDeltaMs: 0,
  // ── 콜백/LA 멈춤 ────────────────────────────────────────────────────────────
  maxCbGapMs: 0,            // 연속 GPS 콜백 최대 간격
  lastCbGapMs: 0,
  lastLaUpdateAtMs: 0,
  maxLaGapMs: 0,            // LA update 호출 간 최대 간격 ('몇 분 멈춤' 줄었나)
};

export function resetEngineDiag(): void {
  engineDiag.active = false;
  engineDiag.playing = false;
  engineDiag.restartCount = 0;
  engineDiag.startedAtMs = 0;
  engineDiag.interruptionCount = 0;
  engineDiag.lastInterruptionAtMs = 0;
  engineDiag.lastInterruptionKind = '';
  engineDiag.lastInterruptionDurationMs = null;
  engineDiag.lastBoxBoxDeltaMs = null;
  engineDiag.maxBoxBoxDeltaMs = 0;
  engineDiag.lastFullPushDeltaMs = null;
  engineDiag.maxFullPushDeltaMs = 0;
  engineDiag.maxCbGapMs = 0;
  engineDiag.lastCbGapMs = 0;
  engineDiag.lastLaUpdateAtMs = 0;
  engineDiag.maxLaGapMs = 0;
}

export function resetGpsDiag(): void {
  // useGPS 사이클 카운터만 reset. defineCalled / earlyReg 등 module-load 관련은
  // 한 번만 결정되므로 reset 대상이 아님.
  gpsDiag.enabled = false;
  gpsDiag.fgPerm = null;
  gpsDiag.bgPerm = null;
  gpsDiag.tick = 0;
  gpsDiag.nullCount = 0;
  gpsDiag.accSkipCount = 0;
  gpsDiag.distSkipCount = 0;
  gpsDiag.acceptCount = 0;
  gpsDiag.lastAccuracy = null;
  gpsDiag.lastDist = null;
  gpsDiag.totalAccumulatedKm = 0;
  gpsDiag.cleanupCount = 0;
  gpsDiag.taskRegistered = null;
  gpsDiag.taskStarted = null;
  gpsDiag.taskWriteCount = 0;
  gpsDiag.lastTaskWriteTs = 0;
  gpsDiag.startError = '';
}

/**
 * 세션 시작 시 측정 카운터만 리셋. fgPerm/bgPerm/enabled 등 권한·설정값은 유지.
 * 세션 간 잔존값 오염 제거 목적 (검증 산책에서 이전 세션 수치가 누적되는 문제).
 */
export function resetSessionDiag(): void {
  gpsDiag.taskWriteCount = 0;
  gpsDiag.acceptCount = 0;
  gpsDiag.distSkipCount = 0;
  gpsDiag.accSkipCount = 0;
  gpsDiag.nullCount = 0;
  gpsDiag.totalAccumulatedKm = 0;
  gpsDiag.lastDist = null;
  gpsDiag.ghostCleared = 0;
  gpsDiag.bgEventCallCount = 0;
  gpsDiag.bgEventPlanNull = 0;
  gpsDiag.bgEventQualifying = 0;
  gpsDiag.bgEventFullPushFired = 0;
  gpsDiag.bgEventBoxBoxFired = 0;
  gpsDiag.bgEventWorkNotReady = 0;
  gpsDiag.bgEventNotWorkPhase = 0;
  gpsDiag.bgTw = 0;
  gpsDiag.bgLaTried = 0;
  gpsDiag.bgLaOk = 0;
  gpsDiag.lockEnterKm = null;
  gpsDiag.lockExitKm = null;
  laDiag.pushTried = 0;
  laDiag.pushOk = 0;
  laDiag.pushFail = 0;
  laDiag.nativeMiss = 0;
  laDiag.lastPushDistKm = null;
  laDiag.lastPushWasBg = false;
  laDiag.fgLaPush = 0;
  resetEngineDiag();
}
