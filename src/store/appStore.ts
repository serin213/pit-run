import { PALETTE } from '../constants/colors';
import { create } from 'zustand';
import type { Program } from '../lib/training/buildProgram';
import { createMMKV } from 'react-native-mmkv';
import type { TireType } from '../constants/colors';
import type { QualifyingResult, UserProfile } from '../types';

// Re-export for backward compatibility — 기존 import 경로 유지용.
// 신규 코드는 `src/types` 에서 직접 import 해 주세요.
export type { QualifyingResult, UserProfile };

// ─── MMKV persistence ───────────────────────────────────────────────────────

// Lazy init: New Architecture에서 native module이 모듈 로드 시점에 준비되지 않을 수 있음.
let _storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!_storage) {
    try {
      _storage = createMMKV({ id: 'app-store' });
      if (__DEV__) console.warn('[PROFILE-DIAG] createMMKV OK');
    } catch (e) {
      if (__DEV__) console.warn('[PROFILE-DIAG] createMMKV THREW:', String(e));
      throw e;
    }
  }
  return _storage;
}

type PersistedState = {
  profile: UserProfile;
  qualifyingResult: QualifyingResult | null;
  activityDates: string[];
  totalDistanceKm: number;
  paceRecords: { bestEver: number | null; todayBest: number | null };
  /** circuitId → last raced timestamp (ms). 홈 추천 서킷 로테이션용. */
  lastRaceByCircuit: Record<string, number>;
};

function loadPersisted(): Partial<PersistedState> {
  try {
    const raw = getStorage().getString('state');
    if (!raw) {
      if (__DEV__) console.warn('[PROFILE-DIAG] loadPersisted: getString("state") returned null/undefined');
      return {};
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (__DEV__) console.warn('[PROFILE-DIAG] loadPersisted OK. profile=', JSON.stringify(parsed.profile));
    return parsed;
  } catch (e) {
    if (__DEV__) console.warn('[PROFILE-DIAG] loadPersisted THREW:', String(e));
    return {};
  }
}

function persist(state: PersistedState) {
  try {
    getStorage().set('state', JSON.stringify(state));
    if (__DEV__) console.warn('[PROFILE-DIAG] persist OK. profile.displayName=', state.profile.displayName);
  } catch (e) {
    if (__DEV__) console.warn('[PROFILE-DIAG] persist THREW:', String(e));
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

const saved = loadPersisted();

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'LEC',
  raceNumber: '16',
  nameTagAccentColor: PALETTE.red,
};

const DEFAULT_PACE_RECORDS = {
  bestEver: Number.POSITIVE_INFINITY,
  todayBest: Number.POSITIVE_INFINITY,
};

type PaceRecords = typeof DEFAULT_PACE_RECORDS;

function normalizePaceRecord(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : Number.POSITIVE_INFINITY;
}

function hydratePaceRecords(value: unknown): PaceRecords {
  if (!value || typeof value !== 'object') return DEFAULT_PACE_RECORDS;
  const raw = value as Partial<Record<keyof PaceRecords, unknown>>;
  return {
    bestEver: normalizePaceRecord(raw.bestEver),
    todayBest: normalizePaceRecord(raw.todayBest),
  };
}

function serializePaceRecords(records: PaceRecords): PersistedState['paceRecords'] {
  return {
    bestEver: Number.isFinite(records.bestEver) ? records.bestEver : null,
    todayBest: Number.isFinite(records.todayBest) ? records.todayBest : null,
  };
}

interface AppState {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;

  selectedCircuitId: string | null;
  setSelectedCircuitId: (id: string | null) => void;

  selectedTire: TireType;
  setSelectedTire: (tire: TireType) => void;

  qualifyingResult: QualifyingResult | null;
  setQualifyingResult: (result: QualifyingResult | null) => void;

  paceRecords: PaceRecords;
  updatePaceRecord: (pace: number) => void;

  activityDates: string[];
  recordActivity: () => void;

  /** 퀄리파잉 세션이 있었던 날짜 목록. 비지속(서버 동기화). */
  qualifyingDates: string[];
  /** 오늘 날짜를 qualifyingDates에 추가 (퀄리파잉 1km 완주 시 호출). */
  recordQualifyingDateToday: () => void;

  totalDistanceKm: number;
  addDistance: (km: number) => void;


  /** 현재 진행 중인 레이스의 analytics eventId. 비지속성(휘발). */
  currentRaceEventId: string | null;
  setCurrentRaceEventId: (id: string | null) => void;

  /** 현재 RunningScreen에서 실행 중인 인터벌 프로그램. 비지속성(휘발). */
  activePlan: Program | null;
  setActivePlan: (plan: Program | null) => void;

  /** circuitId → 마지막 완주 시각(ms). 홈 추천 서킷 로테이션용. */
  lastRaceByCircuit: Record<string, number>;
  recordCircuitRace: (circuitId: string) => void;

  /** 계정 삭제/로그아웃성 로컬 초기화. 저장소 clear 이후 메모리 상태를 기본값으로 되돌림. */
  resetAppState: () => void;
}

/** persist할 필드만 추출 */
function extractPersisted(state: AppState): PersistedState {
  return {
    profile: state.profile,
    qualifyingResult: state.qualifyingResult,
    activityDates: state.activityDates,
    totalDistanceKm: state.totalDistanceKm,
    paceRecords: serializePaceRecords(state.paceRecords),
    lastRaceByCircuit: state.lastRaceByCircuit,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: saved.profile ?? DEFAULT_PROFILE,
  setProfile: (profile) => {
    set({ profile });
    persist(extractPersisted({ ...get(), profile }));
  },

  selectedCircuitId: null,
  setSelectedCircuitId: (id) => set({ selectedCircuitId: id }),

  selectedTire: 'soft',
  setSelectedTire: (tire) => set({ selectedTire: tire }),

  qualifyingResult: saved.qualifyingResult ?? null,
  setQualifyingResult: (result) => {
    set({ qualifyingResult: result });
    persist(extractPersisted({ ...get(), qualifyingResult: result }));
  },

  paceRecords: hydratePaceRecords(saved.paceRecords),
  updatePaceRecord: (pace) => {
    if (!Number.isFinite(pace) || pace <= 0) return;
    const prev = get().paceRecords;
    const bestEver = Math.min(prev.bestEver, pace);
    const todayBest = Math.min(prev.todayBest, pace);
    if (bestEver === prev.bestEver && todayBest === prev.todayBest) return;
    const paceRecords = { bestEver, todayBest };
    set({ paceRecords });
    persist(extractPersisted({ ...get(), paceRecords }));
  },

  activityDates: saved.activityDates ?? [],
  recordActivity: () => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = get().activityDates;
    if (!prev.includes(today)) {
      const activityDates = [...prev, today];
      set({ activityDates });
      persist(extractPersisted({ ...get(), activityDates }));
    }
  },

  qualifyingDates: [],
  recordQualifyingDateToday: () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const current = get().qualifyingDates;
    if (current.includes(iso)) return;
    set({ qualifyingDates: [...current, iso] });
  },

  totalDistanceKm: saved.totalDistanceKm ?? 0,
  addDistance: (km) => {
    const totalDistanceKm = get().totalDistanceKm + km;
    set({ totalDistanceKm });
    persist(extractPersisted({ ...get(), totalDistanceKm }));
  },


  currentRaceEventId: null,
  setCurrentRaceEventId: (id) => set({ currentRaceEventId: id }),

  activePlan: null,
  setActivePlan: (plan) => set({ activePlan: plan }),

  lastRaceByCircuit: saved.lastRaceByCircuit ?? {},
  recordCircuitRace: (circuitId) => {
    const lastRaceByCircuit = { ...get().lastRaceByCircuit, [circuitId]: Date.now() };
    set({ lastRaceByCircuit });
    persist(extractPersisted({ ...get(), lastRaceByCircuit }));
  },

  resetAppState: () => {
    set({
      profile: DEFAULT_PROFILE,
      selectedCircuitId: null,
      selectedTire: 'soft',
      qualifyingResult: null,
      paceRecords: DEFAULT_PACE_RECORDS,
      activityDates: [],
      qualifyingDates: [],
      totalDistanceKm: 0,
      currentRaceEventId: null,
      activePlan: null,
      lastRaceByCircuit: {},
    });
  },
}));
