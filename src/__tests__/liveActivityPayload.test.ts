import { describe, expect, it } from 'vitest';
import {
  buildLiveActivityContentState,
  buildLiveActivityApnsPayload,
  liveActivityPushPriority,
  isLiveActivityVisualTransition,
  type LiveActivityStateInput,
} from '../core/liveActivityPayload';

const baseState: LiveActivityStateInput = {
  distKm: 3.2,
  elapsedMs: 600_000,
  paceS: 300,
  sector: 'red',
  tire: 'medium',
  pitPhase: 'none',
  prog: 0.45,
  isPaused: false,
  mode: 'race',
};

describe('buildLiveActivityContentState', () => {
  it('maps all fields and normalizes optional timers to null', () => {
    const cs = buildLiveActivityContentState(baseState);
    expect(cs).toEqual({
      distKm: 3.2,
      elapsedMs: 600_000,
      paceS: 300,
      sector: 'red',
      tire: 'medium',
      pitPhase: 'none',
      prog: 0.45,
      isPaused: false,
      mode: 'race',
      timerStartMs: null,
      timerEndMs: null,
    });
  });

  it('preserves provided timer values', () => {
    const cs = buildLiveActivityContentState({ ...baseState, timerStartMs: 1700, timerEndMs: 9900 });
    expect(cs.timerStartMs).toBe(1700);
    expect(cs.timerEndMs).toBe(9900);
  });
});

describe('priority / transition decision', () => {
  it('marks boxbox/fullPush/completed as visual transitions', () => {
    expect(isLiveActivityVisualTransition('boxbox')).toBe(true);
    expect(isLiveActivityVisualTransition('fullPush')).toBe(true);
    expect(isLiveActivityVisualTransition('completed')).toBe(true);
  });

  it('treats none/inPit as non-transitions', () => {
    expect(isLiveActivityVisualTransition('none')).toBe(false);
    expect(isLiveActivityVisualTransition('inPit')).toBe(false);
  });

  it('uses priority 10 for transitions, 5 otherwise', () => {
    expect(liveActivityPushPriority(true)).toBe(10);
    expect(liveActivityPushPriority(false)).toBe(5);
  });
});

describe('buildLiveActivityApnsPayload', () => {
  const cs = buildLiveActivityContentState(baseState);

  it('builds aps with epoch-seconds timestamp and content-state', () => {
    const payload = buildLiveActivityApnsPayload({ contentState: cs, timestampMs: 1_700_000_500 });
    expect(payload.aps.timestamp).toBe(1_700_000); // ms → s floor
    expect(payload.aps.event).toBe('update');
    expect(payload.aps['content-state']).toBe(cs);
    expect(payload.aps['stale-date']).toBeUndefined();
    expect('alert' in payload.aps).toBe(false);
    expect('sound' in payload.aps).toBe(false);
  });

  it('converts stale/dismissal dates to epoch seconds and includes relevance', () => {
    const payload = buildLiveActivityApnsPayload({
      contentState: cs,
      event: 'end',
      timestampMs: 2_000_000_000,
      staleDateMs: 2_000_060_000,
      relevanceScore: 100,
      dismissalDateMs: 2_000_120_000,
    });
    expect(payload.aps.event).toBe('end');
    expect(payload.aps['stale-date']).toBe(2_000_060);
    expect(payload.aps['relevance-score']).toBe(100);
    expect(payload.aps['dismissal-date']).toBe(2_000_120);
  });
});
