/**
 * 런타임 GPS A/B 토글 — 세션 한정, 영속화 없음.
 * "다음 GPS 시작 시 적용" (세션 중 재시작 로직 없음).
 *
 * 의심 변경점:
 *   - 6/9 activityType: Fitness (645e2d7)
 *   - 6/10 CLBackgroundActivitySession (ec1baa1)
 * 실기기 외출 1회로 잠금 중 GPS 정지 원인을 특정하기 위한 계측.
 */
export const debugGpsConfig = {
  useFitnessActivityType: true, // false → Location.LocationActivityType.Other
  useBgSession: true,           // false → CLBackgroundActivitySession 시작 스킵
  bgAudioMode: true,            // false → setAudioModeAsync shouldPlayInBackground: false
};
