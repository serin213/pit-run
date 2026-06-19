/**
 * 엔진음 keep-alive — 잠금 중 앱 생존을 위한 연속 오디오 재생.
 *
 * 배경: iOS는 audio background mode(UIBackgroundModes:["audio"]) 앱이 "실제로 오디오를
 * 출력 중"이면 suspend하지 않는다(음악/메트로놈 앱과 동일). 들리는 F1 엔진음을 무한
 * 루프로 연속 재생해 앱을 살려두면, 잠금 중에도 box-box 시간평가/LA update/햅틱이
 * 제때 돈다.
 *
 * 세션: 단일 mixWithOthers 세션(사용자 음악과 공존) + playsInSilentMode(무음 스위치
 * 우회) + shouldPlayInBackground. 동적 카테고리 스위칭(mix↔duck) 금지 — 글리치/인터럽션
 * 유발 + keep-alive가 순간 끊길 수 있음. box-box 효과음은 audio.ts의 별도 플레이어로
 * 위에 레이어링한다(엔진 루프는 안 건드림).
 *
 * 인터럽션 복구(2층):
 *  1) 네이티브 pit-run-audio-session이 AVAudioSession.interruptionNotification을 직접
 *     구독 → .began/.ended(+shouldResume) 정확한 이벤트 emit. .ended+shouldResume는
 *     iOS가 재개를 허가한 순간이라 그때 play()하면 백그라운드 재시작이 안정적.
 *  2) 워치독 ensureEngineAlive() — 완전 suspend로 네이티브 이벤트조차 놓친 케이스 보정.
 *     1초 interval + AppState active + location 콜백 심박에서 호출 → 죽었으면 되살림.
 *
 * Toss 미니앱: 이 파일은 토스 화면유지 SDK로 교체(엔진음 keep-alive는 iOS 네이티브 한정).
 * Android: location foreground service가 이미 suspend를 막으므로 keep-alive 불필요 —
 * 이 모듈은 iOS에서만 의미.
 */

import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { type EventSubscription } from 'expo-modules-core';
import PitRunAudioSession from 'pit-run-audio-session';
import { engineDiag } from './gpsDiag';
import { useAppStore } from '../store/appStore';

/** 설정의 Engine Sound 토글 (기본 ON). OFF면 keep-alive 미동작. */
function isEngineSoundEnabled(): boolean {
  return useAppStore.getState().engineSoundEnabled !== false;
}

// TODO(asset): 임시 placeholder — 짧은 mp3라 루프마다 미세 갭 발생 → keep-alive "측정"엔
// 부적합(배선/컴파일 검증용). 실측 전 gapless ≥30s 엔진음(caf/wav)으로 교체할 것.
// 교체 시 이 require 한 줄만 바꾸면 됨.
const ENGINE_LOOP_SOURCE = require('../../assets/sound/count-down.mp3');

const isIOS = Platform.OS === 'ios';

let enginePlayer: AudioPlayer | null = null;
let shouldPlay = false;            // 재생 "의도" (race 진행 중 + 토글 ON)
let interruptionBeganAtMs = 0;     // began→ended 지속시간 계산용
let subs: EventSubscription[] = [];

/** 단일 세션 설정 — audio.ts와 동일 카테고리. keep-alive엔 shouldPlayInBackground 필수. */
async function applyKeepAliveAudioMode(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch {}
}

function getEnginePlayer(): AudioPlayer {
  if (!enginePlayer) {
    enginePlayer = createAudioPlayer(ENGINE_LOOP_SOURCE);
    enginePlayer.loop = true;
  }
  return enginePlayer;
}

function syncPlayingDiag(): void {
  engineDiag.active = shouldPlay;
  try {
    engineDiag.playing = !!enginePlayer?.playing;
  } catch {
    engineDiag.playing = false;
  }
}

/**
 * 엔진음 루프 시작 — 레이스 시작 시 1회. foreground(active)에서 호출되므로 정상 시작은
 * 안전. 네이티브 인터럽션 이벤트도 여기서 구독.
 */
export async function startEngineLoop(): Promise<void> {
  if (!isIOS) return;
  // 토글 OFF면 keep-alive 미시작 — 잠금 중 정시성은 포기(사용자 선택). 안내는 설정 시트.
  if (!isEngineSoundEnabled()) {
    shouldPlay = false;
    syncPlayingDiag();
    return;
  }
  shouldPlay = true;
  await applyKeepAliveAudioMode();
  const p = getEnginePlayer();
  p.loop = true;
  try { p.play(); } catch {}
  engineDiag.startedAtMs = Date.now();
  subscribeInterruptions();
  syncPlayingDiag();
}

/** 엔진음 루프 정지 — 레이스 종료/중단 시. */
export function stopEngineLoop(): void {
  if (!isIOS) return;
  shouldPlay = false;
  try { enginePlayer?.pause(); } catch {}
  unsubscribeInterruptions();
  syncPlayingDiag();
}

/**
 * 워치독 — "재생 의도가 있는데 실제로 안 울리면 되살린다".
 * 1초 interval / AppState active / location 콜백 심박 / 네이티브 .ended에서 호출.
 * 앱이 살아있는 모든 실행 기회에서 엔진을 재가동해, 인터럽션 후/잠금 중에도 복구한다.
 */
export async function ensureEngineAlive(): Promise<void> {
  if (!isIOS || !shouldPlay) return;
  // 토글 OFF면 no-op (레이스 중 설정에서 끈 경우 다음 tick에 멈춤).
  if (!isEngineSoundEnabled()) {
    try { enginePlayer?.pause(); } catch {}
    shouldPlay = false;
    syncPlayingDiag();
    return;
  }
  const p = getEnginePlayer();
  let playing = false;
  try { playing = !!p.playing; } catch {}
  if (playing) {
    syncPlayingDiag();
    return;
  }
  // 죽어있음 → 복구: 세션 재활성 → (필요시 소스 리로드) → 재생
  await applyKeepAliveAudioMode();
  try {
    if (!p.isLoaded) p.replace(ENGINE_LOOP_SOURCE);
  } catch {}
  try {
    p.loop = true;
    p.play();
  } catch {}
  engineDiag.restartCount++;
  syncPlayingDiag();
}

export function isEnginePlaying(): boolean {
  try { return !!enginePlayer?.playing; } catch { return false; }
}

// ── 네이티브 인터럽션 이벤트 구독 ─────────────────────────────────────────────

function subscribeInterruptions(): void {
  if (!PitRunAudioSession || subs.length > 0) return;

  subs.push(
    PitRunAudioSession.addListener('interruption', (e) => {
      engineDiag.interruptionCount++;
      engineDiag.lastInterruptionAtMs = Date.now();
      if (e.phase === 'began') {
        interruptionBeganAtMs = Date.now();
        engineDiag.lastInterruptionKind = 'began';
        syncPlayingDiag();
      } else {
        engineDiag.lastInterruptionKind = e.shouldResume ? 'ended-resume' : 'ended';
        engineDiag.lastInterruptionDurationMs =
          interruptionBeganAtMs > 0 ? Date.now() - interruptionBeganAtMs : null;
        // .ended + shouldResume = iOS가 재개 허가한 정확한 순간 → 바로 되살림.
        // shouldResume이 false여도 워치독이 보정하지만, 일단 시도.
        void ensureEngineAlive();
      }
    }),
  );

  subs.push(
    PitRunAudioSession.addListener('routeChange', (e) => {
      engineDiag.lastInterruptionAtMs = Date.now();
      engineDiag.lastInterruptionKind = 'route:' + e.reason;
      // 헤드폰 분리(oldDeviceUnavailable) 시 iOS가 재생을 멈춤 → 되살려 keep-alive 유지.
      if (e.reason === 'oldDeviceUnavailable') {
        engineDiag.interruptionCount++;
        void ensureEngineAlive();
      }
    }),
  );

  subs.push(
    PitRunAudioSession.addListener('mediaServicesReset', () => {
      engineDiag.interruptionCount++;
      engineDiag.lastInterruptionAtMs = Date.now();
      engineDiag.lastInterruptionKind = 'mediaReset';
      // 데몬 크래시 — 플레이어 무효화 가능성 → 소스 리로드 포함 복구.
      try { enginePlayer?.replace(ENGINE_LOOP_SOURCE); } catch {}
      void ensureEngineAlive();
    }),
  );
}

function unsubscribeInterruptions(): void {
  subs.forEach((s) => { try { s.remove(); } catch {} });
  subs = [];
}
