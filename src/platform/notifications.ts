/**
 * Platform notifications — legacy/fallback 예약 로컬 알림.
 *
 * Native: expo-notifications. Toss 미니앱: 이 파일만 토스 알림 SDK로 교체.
 *
 * iOS race 주 경로는 pit-run-run-engine 네이티브 모듈이 AVAudioPlayer로 cue를
 * 재생한다. 이 파일은 Android/dev fallback, stale 예약 알림 취소, 기존 테스트 호환을
 * 위해 유지한다.
 *
 * 트레이드오프: 알림 사운드는 iOS 무음 스위치를 따른다(무음+잠금이면 진동만, 소리 X).
 * 권한 거부 시 areNotificationsGranted()=false → locationTask가 인앱 playSound로 폴백.
 *
 * 잠금/suspend 중엔 JS가 안 돌아 "다음 알림"을 그때 예약할 수 없으므로, 레이스 시작·
 * resume 시 향후 전체 체인을 한꺼번에 예약한다(scheduleIntervalChain).
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// 포그라운드에서도 알림 사운드 재생 (인앱 오디오 제거 후 유일 소스). 배너는 레이스 UI를
// 가리지 않게 끔.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldSetBadge: false,
  }),
});

let permissionGranted = false;

/** locationTask 폴백 분기용 — 권한 없으면 인앱 playSound로 대체. */
export function areNotificationsGranted(): boolean {
  return permissionGranted;
}

/** 권한 요청 (레이스 시작 시). 결과를 캐시. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted
      || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted && current.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      granted = req.granted
        || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }
    permissionGranted = granted;
    // Android: 인터벌 알림 채널 (사운드/중요도).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('intervals', {
        name: 'Interval alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'notif_boxbox',
      });
    }
    return granted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

export type IntervalSound = 'boxbox' | 'fullpush';

const SOUND_FILE: Record<IntervalSound, string> = {
  boxbox: 'notif-boxbox.caf',
  fullpush: 'notif-fullpush.caf',
};

const TEXT: Record<IntervalSound, { title: string; body: string }> = {
  boxbox: { title: 'BOX BOX', body: 'Pit window open — ease off and recover.' },
  fullpush: { title: 'FULL PUSH', body: 'Recovery done — back to race pace!' },
};

/** 특정 시각(ms epoch)에 알림 1건 예약. */
async function scheduleAt(kind: IntervalSound, atMs: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: TEXT[kind].title,
        body: TEXT[kind].body,
        sound: SOUND_FILE[kind],
        ...(Platform.OS === 'android' ? { channelId: 'intervals' } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: atMs,
      },
    });
  } catch {}
}

/** 예약된 알림 전부 취소 (pause / finish / stop / 재예약 전). */
export async function cancelAllIntervalNotifications(): Promise<void> {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}

// 한 번에 예약할 이벤트 상한 (free-run의 maxReps=무한 대비; iOS 64개 한도 내).
const SCHEDULE_CAP = 40;

type ChainPlan = {
  nextBoxBoxAtMs: number | null;
  nextFullPushAtMs: number | null;
  predictedWorkMs: number;
  recoveryDurationMs: number;
  completedReps: number;
  maxReps: number;
};

/**
 * 현재 plan 상태에서 향후 box-box/풀푸시 알림 체인을 한꺼번에 예약.
 * 레이스 시작·resume에서 호출. 권한 없으면 no-op(폴백은 locationTask). 항상 먼저 전부 취소.
 * boxBoxAlertMs = useRunning/locationTask의 BOXBOX_ALERT_MS와 동일.
 */
export async function scheduleIntervalChain(
  plan: ChainPlan,
  now: number,
  boxBoxAlertMs: number,
): Promise<void> {
  await cancelAllIntervalNotifications();
  if (!permissionGranted) return;
  if (plan.predictedWorkMs <= 0) return;

  const pitMs = boxBoxAlertMs + plan.recoveryDurationMs;
  let reps = plan.completedReps;
  let scheduled = 0;

  // 회복(pit) 단계면 먼저 다가오는 풀푸시부터, 아니면 work 단계라 box-box부터.
  let boxTimeMs: number;
  if (plan.nextFullPushAtMs != null) {
    if (plan.nextFullPushAtMs > now) { await scheduleAt('fullpush', plan.nextFullPushAtMs); scheduled++; }
    boxTimeMs = plan.nextFullPushAtMs + plan.predictedWorkMs;
  } else {
    boxTimeMs = plan.nextBoxBoxAtMs ?? (now + plan.predictedWorkMs);
  }

  while (reps < plan.maxReps && scheduled < SCHEDULE_CAP) {
    if (boxTimeMs > now) { await scheduleAt('boxbox', boxTimeMs); scheduled++; }
    reps++;
    if (scheduled >= SCHEDULE_CAP) break;
    const fpMs = boxTimeMs + pitMs;
    if (fpMs > now) { await scheduleAt('fullpush', fpMs); scheduled++; }
    boxTimeMs = fpMs + plan.predictedWorkMs;
  }
}
