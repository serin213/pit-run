/**
 * Platform notifications abstraction
 *
 * Native: expo-notifications (향후 구현)
 * Toss 미니앱: 토스 알림 SDK (향후 구현)
 *
 * 이 파일만 교체하면 미니앱 전환 가능
 */

import { Platform } from 'react-native';

export type PushToken = string;

/** Push token 등록 — 실제 구현은 expo-notifications 연동 시 추가 */
export async function registerForPushNotifications(): Promise<PushToken | null> {
  // TODO: expo-notifications 설치 후 구현
  // 1. requestPermissionsAsync()
  // 2. getExpoPushTokenAsync() or getDevicePushTokenAsync()
  return null;
}

/** 로컬 알림 스케줄링 */
export async function scheduleLocalNotification(_options: {
  title: string;
  body: string;
  trigger?: { seconds: number };
}): Promise<void> {
  // TODO: expo-notifications 설치 후 구현
}

export function getPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}
