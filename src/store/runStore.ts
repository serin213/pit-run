import { create } from 'zustand';
import type { TireType, SectorColor } from '../constants/colors';
import { BASE_PACE_S, PACE_RECORD_INTERVAL_KM } from '../constants/tires';
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from './appStore';

export interface TyreSegment {
  tire: TireType;
  startDist: number;
  endDist: number;
}

export interface LapEntry {
  idx: number;
  type: 'lap' | 'pit';
  distM: number;
  durationSec: number;
  paceS: number | null;
}

interface RunState {
  // 러닝 상태
  isRunning: boolean;
  isPaused: boolean;

  // 측정값
  distKm: number;
  elapsedMs: number;
  paceS: number;
  prog: number; // 서킷 진행률 0~1

  // 섹터/타이어
  sector: SectorColor;
  tire: TireType;

  // 히스토리
  paceHistory: number[];
  lastRecordDist: number;
  tyreLog: TyreSegment[];

  // BOX BOX
  boxBoxActive: boolean;
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';

  // GPS
  gpsEnabled: boolean;

  // 랩 기록
  lapLog: LapEntry[];
  isFinalLap: boolean;

  // 레이스 식별 — startRun에서 1회 생성, ResultScreen이 stable 식별자로 사용.
  // navigation.replace('Result')가 두 번 호출되어 Result가 re-mount되어도
  // 같은 raceId + raceStartedAt로 INSERT → DB에서 upsert로 중복 차단.
  raceId: string | null;
  raceStartedAt: string | null;

  // 액션
  startRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  stopRun: () => void;
  resetRun: () => void;
  tick: (dtMs: number) => void;
  /** GPS 실측 거리 추가 (km). background task에서 필터링된 누적값 delta. */
  addGpsDistance: (km: number) => void;
  setGpsEnabled: (enabled: boolean) => void;
  setSector: (sector: SectorColor) => void;
  setTire: (tire: TireType) => void;
  triggerBoxBox: () => void;
  closeBoxBox: () => void;
  setBoxBoxActive: (active: boolean) => void;
  setPitPhase: (phase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed') => void;
  pushLap: (entry: LapEntry) => void;
  setFinalLap: (v: boolean) => void;
}

const INITIAL_STATE = {
  isRunning: false,
  isPaused: false,
  distKm: 0,
  elapsedMs: 0,
  paceS: BASE_PACE_S,
  prog: 0,
  sector: 'yellow' as SectorColor,
  tire: 'medium' as TireType,
  paceHistory: [],
  lastRecordDist: 0,
  tyreLog: [{ tire: 'medium' as TireType, startDist: 0, endDist: 0 }],
  boxBoxActive: false,
  pitPhase: 'none' as const,
  gpsEnabled: false,
  lapLog: [] as LapEntry[],
  isFinalLap: false,
  raceId: null as string | null,
  raceStartedAt: null as string | null,
};

/**
 * UUID v4 생성 — crypto.randomUUID() 가용 시 우선 사용, 폴백은 Math.random.
 * react-native-nitro-modules 등이 crypto polyfill을 깔아주지만 unsupported
 * 환경 대비 폴백 유지.
 *
 * runStore 내부 + QualifyingScreen에서도 import해서 사용. 별도 utility 파일로
 * 빼도 되지만 의존성 단순화 위해 여기 둠.
 */
export function generateUuid(): string {
  try {
    const g = globalThis as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useRunStore = create<RunState>((set, get) => ({
  ...INITIAL_STATE,

  startRun: () =>
    set({
      ...INITIAL_STATE,
      isRunning: true,
      isPaused: false,
      tire: get().tire,
      sector: get().sector,
      tyreLog: [{ tire: get().tire, startDist: 0, endDist: 0 }],
      // race 시작 시점에 1회 생성 — ResultScreen이 re-mount되어도 동일 식별자
      // 사용 → upsert(onConflict:'id')로 DB 중복 차단.
      raceId: generateUuid(),
      raceStartedAt: new Date().toISOString(),
    }),

  pauseRun: () =>
    set({ isPaused: true }),

  resumeRun: () =>
    set({ isPaused: false }),

  stopRun: () =>
    set({ isRunning: false, isPaused: true }),

  resetRun: () =>
    set({
      ...INITIAL_STATE,
      tire: get().tire,
      sector: get().sector,
      tyreLog: [{ tire: get().tire, startDist: 0, endDist: 0 }],
    }),

  tick: (dtMs: number) => {
    const { isPaused, paceS, distKm, elapsedMs, paceHistory, lastRecordDist, tyreLog, pitPhase, gpsEnabled } = get();
    if (isPaused) return;

    const newElapsed = elapsedMs + dtMs;

    // GPS 모드: 시간만 갱신, 거리는 addGpsDistance()로 별도 처리
    if (gpsEnabled) {
      set({ elapsedMs: newElapsed });
      return;
    }

    // 시뮬레이션 모드 (GPS 미연결 시 폴백)
    const isInPit = pitPhase === 'inPit';
    const drift = (Math.random() - 0.5) * (isInPit ? 0.8 : 0.4);
    const minPace = isInPit ? 325 : 265;
    const maxPace = isInPit ? 390 : 340;
    const newPace = Math.max(minPace, Math.min(maxPace, paceS + drift));

    const dKm = dtMs / (newPace * 1000);
    const newDist = distKm + dKm;
    // FIX B: progress를 선택된 서킷 거리 기준으로 계산. 기존 % CIRCUIT_KM 패턴은
    // 모든 서킷이 5.14km인 것처럼 계산되어 짧은/긴 서킷에서 진행률 비례 안 맞음.
    // selectedCircuitId 못 찾으면 0 → CircuitMap이 정지 상태로 보임 (fallback).
    const selectedCircuitId = useAppStore.getState().selectedCircuitId;
    const circuitKm = CIRCUITS.find((c) => c.id === selectedCircuitId)?.distanceKm ?? 0;
    const newProg = circuitKm > 0 ? Math.min(newDist / circuitKm, 1) : 0;

    // 페이스 기록 (500m마다)
    let newHistory = paceHistory;
    let newLastRecord = lastRecordDist;
    if (newDist - lastRecordDist >= PACE_RECORD_INTERVAL_KM) {
      newHistory = [...paceHistory, newPace].slice(-20);
      newLastRecord = newDist;
    }

    // tyreLog 업데이트
    const newTyreLog = [...tyreLog];
    if (newTyreLog.length > 0) {
      newTyreLog[newTyreLog.length - 1] = {
        ...newTyreLog[newTyreLog.length - 1],
        endDist: newDist,
      };
    }

    set({
      paceS: newPace,
      distKm: newDist,
      elapsedMs: newElapsed,
      prog: newProg,
      paceHistory: newHistory,
      lastRecordDist: newLastRecord,
      tyreLog: newTyreLog,
    });
  },

  addGpsDistance: (km: number) => {
    const { isPaused, distKm, elapsedMs, paceHistory, lastRecordDist, tyreLog } = get();
    // 속도 필터는 background task(locationTask.ts)에서 이미 적용됨.
    // isPaused 시 누적 차단 — background task는 계속 누적하지만 foreground는 무시.
    if (km <= 0 || isPaused) return;

    const newDist = distKm + km;
    // FIX B: 서킷별 거리 기반 progress (tick과 동일 패턴).
    const selectedCircuitId = useAppStore.getState().selectedCircuitId;
    const circuitKm = CIRCUITS.find((c) => c.id === selectedCircuitId)?.distanceKm ?? 0;
    const newProg = circuitKm > 0 ? Math.min(newDist / circuitKm, 1) : 0;

    // GPS 실측 페이스 계산: 최근 tick 시간 기준
    // elapsedMs > 0이고 distKm > 0이면 현재 평균 페이스 계산
    const newPace = newDist > 0 ? elapsedMs / 1000 / newDist : BASE_PACE_S;

    // 페이스 기록 (500m마다)
    let newHistory = paceHistory;
    let newLastRecord = lastRecordDist;
    if (newDist - lastRecordDist >= PACE_RECORD_INTERVAL_KM) {
      newHistory = [...paceHistory, newPace].slice(-20);
      newLastRecord = newDist;
    }

    // tyreLog 업데이트
    const newTyreLog = [...tyreLog];
    if (newTyreLog.length > 0) {
      newTyreLog[newTyreLog.length - 1] = {
        ...newTyreLog[newTyreLog.length - 1],
        endDist: newDist,
      };
    }

    set({
      paceS: newPace,
      distKm: newDist,
      prog: newProg,
      paceHistory: newHistory,
      lastRecordDist: newLastRecord,
      tyreLog: newTyreLog,
    });
  },

  setGpsEnabled: (enabled) => set({ gpsEnabled: enabled }),

  setSector: (sector) => set({ sector }),

  setTire: (tire) => {
    const { distKm, tyreLog } = get();
    const newLog = [
      ...tyreLog.map((seg, i) =>
        i === tyreLog.length - 1 ? { ...seg, endDist: distKm } : seg,
      ),
      { tire, startDist: distKm, endDist: distKm },
    ];
    set({ tire, tyreLog: newLog });
  },

  triggerBoxBox: () => set({ boxBoxActive: true, pitPhase: 'boxbox' }),
  closeBoxBox: () => set({ boxBoxActive: false }),
  setBoxBoxActive: (active) => set({ boxBoxActive: active }),
  setPitPhase: (phase) => set({ pitPhase: phase }),
  pushLap: (entry) => set((s) => ({ lapLog: [...s.lapLog, entry] })),
  setFinalLap: (v) => set({ isFinalLap: v }),
}));
