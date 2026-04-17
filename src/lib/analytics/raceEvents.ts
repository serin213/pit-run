import { randomUUID } from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Grade, Tire, Program } from '../training/buildProgram';

// ─── Event types ────────────────────────────────────────────────────────────

export type RaceStartedEvent = {
  type: 'race_started';
  eventId: string;
  userId: string;
  timestamp: number;
  grade: Grade;
  circuitId: string;
  tire: Tire;
  cyclePhase: string;
  program: Program;
};

export type RaceCompletedEvent = {
  type: 'race_completed';
  eventId: string;
  raceStartedEventId: string;
  userId: string;
  timestamp: number;
  completedReps: number;
  actualHardPace: number;
  actualEasyPace: number | null;
  totalDurationSec: number;
};

export type RaceAbandonedEvent = {
  type: 'race_abandoned';
  eventId: string;
  raceStartedEventId: string;
  userId: string;
  timestamp: number;
  abandonedAtRep: number;
  reasonCode: 'user_quit' | 'gps_lost' | 'app_killed' | 'unknown';
};

export type RaceFeedbackEvent = {
  type: 'race_feedback';
  eventId: string;
  raceCompletedEventId: string;
  userId: string;
  timestamp: number;
  feedback: 'too_easy' | 'just_right' | 'too_hard';
};

export type AnalyticsEvent =
  | RaceStartedEvent
  | RaceCompletedEvent
  | RaceAbandonedEvent
  | RaceFeedbackEvent;

// ─── Queue constants ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'pending_events';
const MAX_QUEUE_SIZE = 1000;

// ─── Internal helper ─────────────────────────────────────────────────────────

async function logEvent(event: AnalyticsEvent): Promise<void> {
  console.log('[ANALYTICS]', JSON.stringify(event));

  // TODO: 추후 POST /api/events 로 전송. 실패 시 AsyncStorage에 큐잉해서 재시도

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const queue: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
    queue.push(event);
    // 1000개 초과 시 오래된 것부터 drop
    const trimmed = queue.length > MAX_QUEUE_SIZE ? queue.slice(queue.length - MAX_QUEUE_SIZE) : queue;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage 실패는 로깅에 영향 주지 않도록 무시
  }
}

// ─── Exported log functions ──────────────────────────────────────────────────

export async function logRaceStarted(params: Omit<RaceStartedEvent, 'type' | 'eventId' | 'timestamp'>): Promise<string> {
  const event: RaceStartedEvent = {
    type: 'race_started',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await logEvent(event);
  return event.eventId;
}

export async function logRaceCompleted(params: Omit<RaceCompletedEvent, 'type' | 'eventId' | 'timestamp'>): Promise<string> {
  const event: RaceCompletedEvent = {
    type: 'race_completed',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await logEvent(event);
  return event.eventId;
}

export async function logRaceAbandoned(params: Omit<RaceAbandonedEvent, 'type' | 'eventId' | 'timestamp'>): Promise<string> {
  const event: RaceAbandonedEvent = {
    type: 'race_abandoned',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await logEvent(event);
  return event.eventId;
}

export async function logRaceFeedback(params: Omit<RaceFeedbackEvent, 'type' | 'eventId' | 'timestamp'>): Promise<string> {
  const event: RaceFeedbackEvent = {
    type: 'race_feedback',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await logEvent(event);
  return event.eventId;
}

// ─── Queue management ────────────────────────────────────────────────────────

/** 큐에 쌓인 이벤트 전체 반환 */
export async function getPendingEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalyticsEvent[];
  } catch {
    return [];
  }
}

/** 전송 성공한 이벤트 제거 */
export async function clearPendingEvents(eventIds: string[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw) as AnalyticsEvent[];
    const idSet = new Set(eventIds);
    const remaining = queue.filter((e) => !idSet.has(e.eventId));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // 실패 무시
  }
}
