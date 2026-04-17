import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// expo-crypto: 매 호출마다 단조 증가 uuid 반환
let _uuidCounter = 0;
vi.mock('expo-crypto', () => ({
  randomUUID: () => `test-uuid-${++_uuidCounter}`,
}));

// AsyncStorage: 인메모리 구현
const _store: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => _store[key] ?? null,
    setItem: async (key: string, value: string) => { _store[key] = value; },
    removeItem: async (key: string) => { delete _store[key]; },
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  logRaceStarted,
  logRaceCompleted,
  logRaceAbandoned,
  logRaceFeedback,
  getPendingEvents,
  clearPendingEvents,
} from './raceEvents';
import { buildProgram } from '../training/buildProgram';

// ─── Test fixtures ───────────────────────────────────────────────────────────

const MODENA = { id: 'modena', baseIntervalM: 200, baseReps: 8 };
const USER = { trainingBasePace: 360, grade: 'f2' as const, totalSessionCount: 0 };
const program = buildProgram(USER, MODENA, 'medium');

const BASE_STARTED_PARAMS = {
  userId: 'user-1',
  grade: 'f2' as const,
  circuitId: 'modena',
  tire: 'medium' as const,
  cyclePhase: 'BASE',
  program,
};

beforeEach(() => {
  // 스토어 초기화
  Object.keys(_store).forEach((k) => delete _store[k]);
  _uuidCounter = 0;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('logRaceStarted', () => {
  it('생성된 이벤트의 type이 race_started', async () => {
    await logRaceStarted(BASE_STARTED_PARAMS);
    const events = await getPendingEvents();
    expect(events[0].type).toBe('race_started');
  });

  it('eventId가 반환되고 큐의 이벤트와 일치', async () => {
    const eventId = await logRaceStarted(BASE_STARTED_PARAMS);
    const events = await getPendingEvents();
    expect(events[0].eventId).toBe(eventId);
  });
});

describe('logRaceCompleted', () => {
  it('생성된 이벤트의 type이 race_completed', async () => {
    const startedId = await logRaceStarted(BASE_STARTED_PARAMS);
    await logRaceCompleted({
      raceStartedEventId: startedId,
      userId: 'user-1',
      completedReps: 6,
      actualHardPace: 340,
      actualEasyPace: 468,
      totalDurationSec: 1200,
    });
    const events = await getPendingEvents();
    const completed = events.find((e) => e.type === 'race_completed');
    expect(completed?.type).toBe('race_completed');
  });

  it('raceStartedEventId가 정확히 연결됨', async () => {
    const startedId = await logRaceStarted(BASE_STARTED_PARAMS);
    await logRaceCompleted({
      raceStartedEventId: startedId,
      userId: 'user-1',
      completedReps: 6,
      actualHardPace: 340,
      actualEasyPace: null,
      totalDurationSec: 1200,
    });
    const events = await getPendingEvents();
    const completed = events.find((e) => e.type === 'race_completed');
    if (completed?.type !== 'race_completed') throw new Error('not found');
    expect(completed.raceStartedEventId).toBe(startedId);
  });
});

describe('logRaceAbandoned', () => {
  it('생성된 이벤트의 type이 race_abandoned', async () => {
    const startedId = await logRaceStarted(BASE_STARTED_PARAMS);
    await logRaceAbandoned({
      raceStartedEventId: startedId,
      userId: 'user-1',
      abandonedAtRep: 3,
      reasonCode: 'user_quit',
    });
    const events = await getPendingEvents();
    const abandoned = events.find((e) => e.type === 'race_abandoned');
    expect(abandoned?.type).toBe('race_abandoned');
  });
});

describe('logRaceFeedback', () => {
  it('생성된 이벤트의 type이 race_feedback', async () => {
    const startedId = await logRaceStarted(BASE_STARTED_PARAMS);
    const completedId = await logRaceCompleted({
      raceStartedEventId: startedId,
      userId: 'user-1',
      completedReps: 6,
      actualHardPace: 340,
      actualEasyPace: 468,
      totalDurationSec: 1200,
    });
    await logRaceFeedback({
      raceCompletedEventId: completedId,
      userId: 'user-1',
      feedback: 'just_right',
    });
    const events = await getPendingEvents();
    const feedback = events.find((e) => e.type === 'race_feedback');
    expect(feedback?.type).toBe('race_feedback');
  });
});

describe('eventId uniqueness', () => {
  it('연속 호출 시 eventId가 매번 다름', async () => {
    const id1 = await logRaceStarted(BASE_STARTED_PARAMS);
    const id2 = await logRaceStarted(BASE_STARTED_PARAMS);
    const id3 = await logRaceStarted(BASE_STARTED_PARAMS);
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
  });
});

describe('queue management', () => {
  it('getPendingEvents가 모든 누적 이벤트 반환', async () => {
    await logRaceStarted(BASE_STARTED_PARAMS);
    await logRaceStarted(BASE_STARTED_PARAMS);
    const events = await getPendingEvents();
    expect(events.length).toBe(2);
  });

  it('clearPendingEvents가 지정 eventId만 제거', async () => {
    const id1 = await logRaceStarted(BASE_STARTED_PARAMS);
    await logRaceStarted(BASE_STARTED_PARAMS);
    await clearPendingEvents([id1]);
    const events = await getPendingEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventId).not.toBe(id1);
  });
});
