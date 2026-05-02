/**
 * Pace / distance / time 유틸리티 — 순수 함수, React/RN 의존 없음.
 * 미니앱에서 그대로 import 가능.
 */

/** sec/km 페이스를 "M'SS\"" 형식 문자열로 변환 */
export function formatPace(paceSecPerKm: number): string {
  let min = Math.floor(paceSecPerKm / 60);
  let sec = Math.round(paceSecPerKm % 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec < 10 ? '0' : ''}${sec}"`;
}

/** ms를 "M:SS" (분:초) 형식으로 변환 */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

/** ms를 "M:SS.CC" (분:초.센티초) 형식으로 변환 */
export function formatStopwatch(ms: number): string {
  const total = Math.floor(ms / 10);
  const cs = total % 100;
  const sec = Math.floor(total / 100) % 60;
  const min = Math.floor(total / 6000);
  return `${min}:${sec < 10 ? '0' : ''}${sec}.${cs < 10 ? '0' : ''}${cs}`;
}

/** 거리(km)와 시간(ms)으로 페이스(sec/km) 계산 */
export function calculatePace(distKm: number, elapsedMs: number): number {
  if (distKm <= 0) return 0;
  return (elapsedMs / 1000) / distKm;
}

/** km를 n.nn 형식 문자열로 변환 */
export function formatDistance(km: number): string {
  return km.toFixed(2);
}

/** 두 좌표 간 Haversine 거리 (km) */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
