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
};

export const laDiag = {
  pushTried: 0,
  pushOk: 0,
  pushFail: 0,
  lastPushAt: 0,           // timestamp (Date.now())
  lastErrorMsg: '',
  lockTransitions: 0,      // 잠금/언락 transition 횟수
  lastLockState: 'active', // 'active' | 'background' | 'inactive'
};

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
  laDiag.pushTried = 0;
  laDiag.pushOk = 0;
  laDiag.pushFail = 0;
}
