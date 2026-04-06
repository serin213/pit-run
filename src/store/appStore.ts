import { create } from 'zustand';
import type { TireType } from '../constants/colors';

export type QualifyingResult = {
  warmupMinutes: number;
  oneKmMs: number;
  paceSecPerKm: number;
  grade: 'A' | 'B' | 'C' | 'D';
  nextIntervalHint: string;
};

export type UserProfile = {
  displayName: string;
  raceNumber: string;
  nameTagAccentColor: string;
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
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: {
    displayName: 'LEC',
    raceNumber: '16',
    nameTagAccentColor: '#E03A3E',
  },
  setProfile: (profile) => set({ profile }),

  selectedCircuitId: null,
  setSelectedCircuitId: (id) => set({ selectedCircuitId: id }),

  selectedTire: 'soft',
  setSelectedTire: (tire) => set({ selectedTire: tire }),

  qualifyingResult: null,
  setQualifyingResult: (result) => set({ qualifyingResult: result }),

  paceRecords: {
    bestEver: Number.POSITIVE_INFINITY,
    todayBest: Number.POSITIVE_INFINITY,
  },
  updatePaceRecord: (pace) => {
    const prev = get().paceRecords;
    const bestEver = Math.min(prev.bestEver, pace);
    const todayBest = Math.min(prev.todayBest, pace);
    if (bestEver === prev.bestEver && todayBest === prev.todayBest) return;
    set({ paceRecords: { bestEver, todayBest } });
  },

  activityDates: [],
  recordActivity: () => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = get().activityDates;
    if (!prev.includes(today)) {
      set({ activityDates: [...prev, today] });
    }
  },

  totalDistanceKm: 0,
  addDistance: (km) => set((state) => ({ totalDistanceKm: state.totalDistanceKm + km })),

  notificationsEnabled: true,
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
}));
