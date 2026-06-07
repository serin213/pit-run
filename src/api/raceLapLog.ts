/**
 * 묶음 2: lap log를 MMKV에 저장 — background가 lap/pit entry push, foreground는
 * polling으로 read.
 *
 * 이전엔 useRunning이 useRunStore.pushLap 직접 호출했지만, background context는
 * Zustand store 접근 불가 → MMKV에 append하고 foreground가 sync.
 *
 * 정책:
 *   - background maybeFireBackgroundRaceEvents가 boxbox/fullPush 발화 시 entry push
 *   - foreground useRunning이 1초 polling + AppState 'active'마다 read → store.lapLog 갱신
 *   - clearActiveRacePlan 시 같이 clear (race 시작 시 reset)
 */

import { getString, setString, remove } from '../platform/storage';
import type { LapEntry } from '../store/runStore';

const KEY = 'race_lap_log_v1';

export function getRaceLapLog(): LapEntry[] {
  const raw = getString(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LapEntry[];
  } catch {
    return [];
  }
}

export function appendRaceLapEntry(entry: LapEntry): void {
  const existing = getRaceLapLog();
  existing.push(entry);
  setString(KEY, JSON.stringify(existing));
}

export function clearRaceLapLog(): void {
  remove(KEY);
}
