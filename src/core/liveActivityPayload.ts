/**
 * Live Activity APNs payload — 순수 함수 (React/RN import 금지, CLAUDE.md §2).
 *
 * 여기 정의된 ContentState 형태는 다음과 정확히 일치해야 한다:
 *   - modules/pit-run-live-activity/ios/PitRunLiveActivityModule.swift  (PitRunAttributes.ContentState)
 *   - targets/pit-run-live-activity/.../PitRunAttributes.swift          (Widget Extension)
 *   - supabase/functions/live-activity-push                            (서버가 aps.content-state로 전송)
 *
 * APNs로 보내는 content-state의 key는 Swift Codable 이름 그대로(camelCase) 보낸다.
 * (ActivityKit은 JSON key를 ContentState 프로퍼티명과 1:1 매칭하므로 변환 금지.)
 */

export type LiveActivityPitPhase = 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
export type LiveActivityModeName = 'race' | 'qualifying' | 'warmup';

/** Swift PitRunAttributes.ContentState와 1:1. optional 필드는 null로 직렬화한다. */
export interface LiveActivityContentState {
  distKm: number;
  elapsedMs: number;
  paceS: number;
  sector: string;
  tire: string;
  pitPhase: LiveActivityPitPhase;
  prog: number;
  isPaused: boolean;
  mode: LiveActivityModeName;
  timerStartMs: number | null;
  timerEndMs: number | null;
}

export interface LiveActivityStateInput {
  distKm: number;
  elapsedMs: number;
  paceS: number;
  sector: string;
  tire: string;
  pitPhase: LiveActivityPitPhase;
  prog: number;
  isPaused: boolean;
  mode: LiveActivityModeName;
  timerStartMs?: number | null;
  timerEndMs?: number | null;
}

/** LiveActivityState → APNs content-state. optional은 null로 정규화. */
export function buildLiveActivityContentState(
  state: LiveActivityStateInput,
): LiveActivityContentState {
  return {
    distKm: state.distKm,
    elapsedMs: state.elapsedMs,
    paceS: state.paceS,
    sector: state.sector,
    tire: state.tire,
    pitPhase: state.pitPhase,
    prog: state.prog,
    isPaused: state.isPaused,
    mode: state.mode,
    timerStartMs: state.timerStartMs ?? null,
    timerEndMs: state.timerEndMs ?? null,
  };
}

/**
 * APNs priority 결정.
 *  - 10: boxbox/fullPush/finalLap/finish 등 시각 전환 — 즉시 렌더 필요.
 *  - 5 : 일반 거리/타이머 갱신 — 배터리 친화적 cadence, 시스템이 묶어서 전달 허용.
 * 로컬 사운드 타이밍과 무관 — 이건 "렌더"용 우선순위일 뿐이다.
 */
export function liveActivityPushPriority(isVisualTransition: boolean): 5 | 10 {
  return isVisualTransition ? 10 : 5;
}

/** pitPhase가 즉시 렌더가 필요한 시각 전환인지. completed(finish 포함)도 전환으로 취급. */
export function isLiveActivityVisualTransition(phase: LiveActivityPitPhase): boolean {
  return phase === 'boxbox' || phase === 'fullPush' || phase === 'completed';
}

export type LiveActivityPushEvent = 'update' | 'end';

export interface LiveActivityApnsPayload {
  aps: {
    timestamp: number; // epoch seconds
    event: LiveActivityPushEvent;
    'content-state': LiveActivityContentState;
    'stale-date'?: number; // epoch seconds
    'relevance-score'?: number;
    'dismissal-date'?: number; // epoch seconds (event=end)
  };
}

export interface BuildApnsPayloadInput {
  contentState: LiveActivityContentState;
  event?: LiveActivityPushEvent;
  /** epoch ms — 미지정 시 now. */
  timestampMs?: number;
  /** epoch ms — iOS가 이 시점 이후 LA를 stale 처리. */
  staleDateMs?: number;
  relevanceScore?: number;
  /** epoch ms — event=end일 때 잠금화면에서 제거될 시각. */
  dismissalDateMs?: number;
}

/**
 * ActivityKit liveactivity APNs payload 조립.
 * aps.timestamp / stale-date / dismissal-date는 APNs 규격상 epoch "초".
 * 서버 Edge Function이 동일 로직을 쓰며, 이 함수로 클라이언트/테스트가 검증한다.
 */
export function buildLiveActivityApnsPayload(
  input: BuildApnsPayloadInput,
): LiveActivityApnsPayload {
  const nowMs = input.timestampMs ?? Date.now();
  const aps: LiveActivityApnsPayload['aps'] = {
    timestamp: Math.floor(nowMs / 1000),
    event: input.event ?? 'update',
    'content-state': input.contentState,
  };
  if (input.staleDateMs != null) aps['stale-date'] = Math.floor(input.staleDateMs / 1000);
  if (input.relevanceScore != null) aps['relevance-score'] = input.relevanceScore;
  if (input.dismissalDateMs != null) aps['dismissal-date'] = Math.floor(input.dismissalDateMs / 1000);
  return { aps };
}
