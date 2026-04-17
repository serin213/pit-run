import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { TireType } from '../constants/colors';
import type { QualifyingResult, UserProfile } from '../types';

// Re-export for backward compatibility — 기존 import 경로 유지용.
// 신규 코드는 `src/types` 에서 직접 import 해 주세요.
export type { QualifyingResult, UserProfile };

// ─── MMKV persistence ───────────────────────────────────────────────────────

const storage = createMMKV({ id: 'app-store' });

type PersistedState = {
  profile: UserProfile;
  qualifyingResult: QualifyingResult | null;
  activityDates: string[];
  totalDistanceKm: number;
  paceRecords: { bestEver: number; todayBest: number };
  notificationsEnabled: boolean;
};

function loadPersisted(): Partial<PersistedState> {
  try {
    const raw = storage.getString('state');
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function persist(state: PersistedState) {
  try {
    storage.set('state', JSON.stringify(state));
  } catch {
    // storage write failure — ignore
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

const saved = loadPersisted();

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'LEC',
  raceNumber: '16',
  nameTagAccentColor: '#E03A3E',
};

const DEFAULT_PACE_RECORDS = {
  bestEver: Number.POSITIVE_INFINITY,
  todayBest: Number.POSITIVE_INFINITY,
};

interface AppState {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;

  selectedCircuitId: string | null;
  setSelectedCircuitId: (id: string | null) => void;

  selectedTire: TireType;
  setSelectedTire: (tire: TireType) => void;

  qualifyingResult: QualifyingResult | null;
  setQualifyingResult: (result: QualifyingResult | null) => void;

  paceRecords: { bestEver: number; todayBest: number };
  updatePaceRecord: (pace: number) => void;

  activityDates: string[];
  recordActivity: () => void;

  totalDistanceKm: number;
  addDistance: (km: number) => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;

  /** 현재 진행 중인 레이스의 analytics eventId. 비지속성(휘발). */
  currentRaceEventId: string | null;
  setCurrentRaceEventId: (id: string | null) => void;
}

/** persist할 필드만 추출 */
function extractPersisted(state: AppState): PersistedState {
  return {
    profile: state.profile,
    qualifyingResult: state.qualifyingResult,
    activityDates: state.activityDates,
    totalDistanceKm: state.totalDistanceKm,
    paceRecords: state.paceRecords,
    notificationsEnabled: state.notificationsEnabled,
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

  paceRecords: saved.paceRecords ?? DEFAULT_PACE_RECORDS,
  updatePaceRecord: (pace) => {
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

  totalDistanceKm: saved.totalDistanceKm ?? 0,
  addDistance: (km) => {
    const totalDistanceKm = get().totalDistanceKm + km;
    set({ totalDistanceKm });
    persist(extractPersisted({ ...get(), totalDistanceKm }));
  },

  notificationsEnabled: saved.notificationsEnabled ?? true,
  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
    persist(extractPersisted({ ...get(), notificationsEnabled: enabled }));
  },

  currentRaceEventId: null,
  setCurrentRaceEventId: (id) => set({ currentRaceEventId: id }),
}));
