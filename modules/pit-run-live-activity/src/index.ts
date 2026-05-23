import { requireOptionalNativeModule, Platform } from 'expo-modules-core';

interface PitRunLiveActivityNative {
  // mode: "race" | "qualifying" — Lock screen / expanded color 분기.
  startActivity(driverName: string, teamColor: string, circuitId: string, mode: string): Promise<string | null>;
  updateActivity(
    activityId: string,
    distKm: number,
    elapsedMs: number,
    paceS: number,
    sector: string,
    tire: string,
    pitPhase: string,
    prog: number,
    isPaused: boolean,
    mode: string
  ): Promise<void>;
  endActivity(activityId: string): Promise<void>;
  endAllActivities(): Promise<void>;
  isSupported(): boolean;
}

// IMPORTANT: 'PitRunLiveActivity'는 widget extension target name과 동일해서
// EAS prebuild 시 autolinking이 silent fail. Swift Name()도 *Bridge로 등록.
const MODULE_NAME = 'PitRunLiveActivityBridge';

// Lazy lookup on EVERY call — defends against New Arch / TurboModule race where
// the native module isn't registered yet at JS bundle load time. The previous
// implementation captured the lookup once at module load → if that initial
// lookup returned null, the app was permanently stuck on the noop fallback.
function getNativeModule(): PitRunLiveActivityNative | null {
  if (Platform.OS !== 'ios') return null;
  const mod = requireOptionalNativeModule<PitRunLiveActivityNative>(MODULE_NAME);
  if (!mod) {
    console.error(
      `[PitRunLA-DIAG] requireOptionalNativeModule('${MODULE_NAME}') returned null. ` +
      `Module is NOT registered at this call time.`
    );
  }
  return mod;
}

export function isSupported(): boolean {
  const mod = getNativeModule();
  if (!mod) {
    console.error('[PitRunLA-DIAG] isSupported: module missing, returning false');
    return false;
  }
  const result = mod.isSupported();
  console.warn(`[PitRunLA-DIAG] isSupported() → ${result}`);
  return result;
}

export async function startActivity(
  driverName: string,
  teamColor: string,
  circuitId: string,
  mode: string
): Promise<string | null> {
  // 진단: JS가 여기까지 도달했음을 native NSLog로 보장.
  // isSupported는 native에 NSLog 박혀있어서 release에서도 보임 — JS↔native
  // 브릿지의 어느 단계에서 끊기는지 노출됨 (release에선 console.warn이 invisible).
  try {
    const probeMod = getNativeModule();
    if (probeMod) {
      probeMod.isSupported(); // native NSLog "isSupported() → ..." 찍힘
    }
  } catch {}

  const mod = getNativeModule();
  if (!mod) {
    console.error('[PitRunLA-DIAG] startActivity: module missing, returning null');
    return null;
  }
  console.warn('[PitRunLA-DIAG] startActivity: calling native', { driverName, teamColor, circuitId, mode });
  try {
    const id = await mod.startActivity(driverName, teamColor, circuitId, mode);
    console.warn(`[PitRunLA-DIAG] startActivity: native returned id=${id}`);
    return id;
  } catch (e) {
    console.error('[PitRunLA-DIAG] startActivity: native THREW', String(e));
    throw e;
  }
}

export async function updateActivity(
  activityId: string,
  distKm: number,
  elapsedMs: number,
  paceS: number,
  sector: string,
  tire: string,
  pitPhase: string,
  prog: number,
  isPaused: boolean,
  mode: string
): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.updateActivity(activityId, distKm, elapsedMs, paceS, sector, tire, pitPhase, prog, isPaused, mode);
  } catch (e) {
    console.error('[PitRunLA-DIAG] updateActivity threw', String(e));
  }
}

export async function endActivity(activityId: string): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.endActivity(activityId);
  } catch (e) {
    console.error('[PitRunLA-DIAG] endActivity threw', String(e));
  }
}

export async function endAllActivities(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.endAllActivities();
  } catch (e) {
    console.error('[PitRunLA-DIAG] endAllActivities threw', String(e));
  }
}
