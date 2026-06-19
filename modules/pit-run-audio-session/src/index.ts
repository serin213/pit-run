import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

/** 인터럽션 시작/끝. ended일 때 shouldResume = iOS가 재개 허가한 순간. */
export type InterruptionEvent =
  | { phase: 'began' }
  | { phase: 'ended'; shouldResume: boolean };

export type RouteChangeEvent = { reason: string };

interface PitRunAudioSessionNative {
  isSupported(): boolean;
  addListener(event: 'interruption', listener: (e: InterruptionEvent) => void): EventSubscription;
  addListener(event: 'routeChange', listener: (e: RouteChangeEvent) => void): EventSubscription;
  addListener(event: 'mediaServicesReset', listener: () => void): EventSubscription;
}

const PitRunAudioSession =
  requireOptionalNativeModule<PitRunAudioSessionNative>('PitRunAudioSession') ?? null;

export default PitRunAudioSession;
