import { create } from 'zustand';
import type { TireType, SectorColor } from '../constants/colors';
import { BASE_PACE_S, PACE_RECORD_INTERVAL_KM } from '../constants/tires';
import { DEFAULT_CIRCUIT_KM as CIRCUIT_KM } from '../config/circuits';

export interface TyreSegment {
  tire: TireType;
  startDist: number;
  endDist: number;
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
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush';

  // GPS
  gpsEnabled: boolean;

  // 액션
  startRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  stopRun: () => void;
  resetRun: () => void;
  tick: (dtMs: number) => void;
  /** GPS 실측 거리 추가 (km). tick()의 시뮬레이션 거리 대신 사용. */
  addGpsDistance: (km: number) => void;
  setGpsEnabled: (enabled: boolean) => void;
  setSector: (sector: SectorColor) => void;
  setTire: (tire: TireType) => void;
  triggerBoxBox: () => void;
  closeBoxBox: () => void;
  setBoxBoxActive: (active: boolean) => void;
  setPitPhase: (phase: 'none' | 'boxbox' | 'inPit' | 'fullPush') => void;
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
};

export const useRunStore = create<RunState>((set, get) => ({
  ...INITIAL_STATE,

  startRun: () =>
    set({ isRunning: true, isPaused: false }),

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
    const newProg = (newDist % CIRCUIT_KM) / CIRCUIT_KM;

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
    const { distKm, elapsedMs, paceHistory, lastRecordDist, tyreLog } = get();
    if (km <= 0) return;

    const newDist = distKm + km;
    const newProg = (newDist % CIRCUIT_KM) / CIRCUIT_KM;

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
}));
