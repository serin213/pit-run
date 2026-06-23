/**
 * verify-B — lapLog 구조 검증
 *
 * /tmp/verify-B.ts 의 assertions를 vitest 형태로 이식.
 * circuits.ts 는 PNG require가 있어 Node 환경에서 crash → vi.mock 으로 대체.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const memoryStorage = new Map<string, string | boolean>();

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => {
      const value = memoryStorage.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getBoolean: (key: string) => {
      const value = memoryStorage.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    set: (key: string, value: string | boolean) => {
      memoryStorage.set(key, value);
    },
    remove: (key: string) => {
      memoryStorage.delete(key);
    },
    clearAll: () => {
      memoryStorage.clear();
    },
  }),
}));

// ── circuits mock (PNG require 방지) ──────────────────────────────────────────
vi.mock('../config/circuits', () => ({
  DEFAULT_CIRCUIT_KM: 5.14,
  CIRCUITS: [
    {
      id: 'shanghai',
      displayName: 'Shanghai',
      distanceKm: 5.14,
      baseIntervalM: 400,
      baseReps: 6,
      direction: 'clockwise',
    },
  ],
}));

// ── react-native mock (zustand 스토어가 RN import 없지만 이행 deps 대비) ──────
vi.mock('react-native', () => ({}));

import { useRunStore } from '../store/runStore';

// ─────────────────────────────────────────────────────────────────────────────

describe('[verify-B] lapLog structure', () => {
  beforeEach(() => {
    memoryStorage.clear();
    useRunStore.getState().resetRun();
  });

  it('lap/pit 순서 및 idx 0-based sequential', () => {
    const store = useRunStore.getState();
    store.pushLap({ idx: 0, type: 'lap', distM: 400,  durationSec: 120.0, paceS: 300 });
    store.pushLap({ idx: 1, type: 'pit', distM: 80,   durationSec: 45.0,  paceS: null });
    store.pushLap({ idx: 2, type: 'lap', distM: 412,  durationSec: 124.0, paceS: 301 });
    store.pushLap({ idx: 3, type: 'pit', distM: 75,   durationSec: 42.0,  paceS: null });
    store.pushLap({ idx: 4, type: 'lap', distM: 405,  durationSec: 122.0, paceS: 301 });

    const log = useRunStore.getState().lapLog;

    expect(log[0].type).toBe('lap');
    expect(log[1].type).toBe('pit');
    expect(log[2].type).toBe('lap');
    expect(log[3].type).toBe('pit');
    expect(log[4].type).toBe('lap');

    for (let i = 0; i < 5; i++) {
      expect(log[i].idx).toBe(i);
    }
  });

  it('모든 엔트리의 distM / durationSec / paceS 는 finite 또는 null', () => {
    const store = useRunStore.getState();
    store.pushLap({ idx: 0, type: 'lap', distM: 400,  durationSec: 120.0, paceS: 300 });
    store.pushLap({ idx: 1, type: 'pit', distM: 80,   durationSec: 45.0,  paceS: null });
    store.pushLap({ idx: 2, type: 'lap', distM: 412,  durationSec: 124.0, paceS: 301 });

    const log = useRunStore.getState().lapLog;
    for (const entry of log) {
      expect(Number.isFinite(entry.distM)).toBe(true);
      expect(Number.isFinite(entry.durationSec)).toBe(true);
      expect(entry.paceS === null || Number.isFinite(entry.paceS)).toBe(true);
    }
  });

  it('pit 엔트리의 paceS === null', () => {
    const store = useRunStore.getState();
    store.pushLap({ idx: 0, type: 'lap', distM: 400,  durationSec: 120.0, paceS: 300 });
    store.pushLap({ idx: 1, type: 'pit', distM: 80,   durationSec: 45.0,  paceS: null });
    store.pushLap({ idx: 2, type: 'lap', distM: 412,  durationSec: 124.0, paceS: 301 });
    store.pushLap({ idx: 3, type: 'pit', distM: 75,   durationSec: 42.0,  paceS: null });

    const log = useRunStore.getState().lapLog;
    expect(log[1].paceS).toBeNull();
    expect(log[3].paceS).toBeNull();
  });

  it('lap 엔트리의 paceS는 null이 아닌 finite 숫자', () => {
    const store = useRunStore.getState();
    store.pushLap({ idx: 0, type: 'lap', distM: 400, durationSec: 120.0, paceS: 300 });
    store.pushLap({ idx: 2, type: 'lap', distM: 412, durationSec: 124.0, paceS: 301 });

    const log = useRunStore.getState().lapLog;
    expect(log[0].paceS).not.toBeNull();
    expect(Number.isFinite(log[0].paceS!)).toBe(true);
    expect(log[1].paceS).not.toBeNull();
    expect(Number.isFinite(log[1].paceS!)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[verify-B] GPS addGpsDistance', () => {
  beforeEach(() => {
    memoryStorage.clear();
    useRunStore.getState().resetRun();
  });

  it('isPaused=true → distKm 누적 안 됨', () => {
    useRunStore.setState({ isPaused: true, distKm: 0 });
    useRunStore.getState().addGpsDistance(0.1);
    expect(useRunStore.getState().distKm).toBe(0);
  });

  it('isPaused=false → 0.1km 정확히 누적', () => {
    useRunStore.setState({ isPaused: false, distKm: 0 });
    useRunStore.getState().addGpsDistance(0.1);
    expect(useRunStore.getState().distKm).toBeCloseTo(0.1, 6);
  });

  it('속도 필터는 background task 책임 — addGpsDistance 는 항상 누적 (dtSec 인자 없음)', () => {
    // v2에서는 속도 필터가 locationTask.ts(background)로 이전됨.
    // addGpsDistance 는 (km: number) 단일 인자만 받고, 받은 값은 무조건 누적.
    useRunStore.setState({ isPaused: false, distKm: 0 });
    useRunStore.getState().addGpsDistance(0.05);
    expect(useRunStore.getState().distKm).toBeCloseTo(0.05, 6);
  });

  it('km <= 0 이면 무시', () => {
    useRunStore.setState({ isPaused: false, distKm: 0 });
    useRunStore.getState().addGpsDistance(0);
    useRunStore.getState().addGpsDistance(-0.1);
    expect(useRunStore.getState().distKm).toBe(0);
  });
});
