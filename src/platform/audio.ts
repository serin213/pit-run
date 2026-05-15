/**
 * Audio playback abstraction for race sounds.
 *
 * Native (iOS/Android): expo-audio
 * Toss 미니앱:           이 파일만 교체
 *
 * Sounds bypass iOS silent-mode (playback category) so they always audible during a race.
 * Players are preloaded once and reused — playing restarts from 0.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundKey =
  | 'countdown'
  | 'boxbox'
  | 'fullPush'
  | 'finalLap'
  | 'qualifyingEnd'
  | 'chequeredFlag';

const SOURCES: Record<SoundKey, number> = {
  countdown:      require('../../assets/sound/count-down.mp3'),
  boxbox:         require('../../assets/sound/boxbox.mp3'),
  fullPush:       require('../../assets/sound/full-push.mp3'),
  finalLap:       require('../../assets/sound/final-lap.mp3'),
  qualifyingEnd:  require('../../assets/sound/qualifying-ending.mp3'),
  chequeredFlag:  require('../../assets/sound/chequered-flag.mp3'),
};

const players: Partial<Record<SoundKey, AudioPlayer>> = {};
let modeConfigured = false;

async function ensureMode() {
  if (modeConfigured) return;
  modeConfigured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    modeConfigured = false;
  }
}

function getPlayer(key: SoundKey): AudioPlayer {
  let p = players[key];
  if (!p) {
    p = createAudioPlayer(SOURCES[key]);
    players[key] = p;
  }
  return p;
}

/** Preload one or more sounds so first play has no delay. */
export async function preloadSounds(keys: SoundKey[]): Promise<void> {
  await ensureMode();
  keys.forEach((k) => getPlayer(k));
}

/** Play a sound from the beginning. Safe to call repeatedly. */
export async function playSound(key: SoundKey): Promise<void> {
  await ensureMode();
  const p = getPlayer(key);
  try {
    p.seekTo(0);
  } catch {}
  try {
    p.play();
  } catch {}
}

/** Release all loaded players. Call on app teardown. */
export function unloadAllSounds(): void {
  (Object.keys(players) as SoundKey[]).forEach((k) => {
    try { players[k]?.remove(); } catch {}
    delete players[k];
  });
}
