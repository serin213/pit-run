/**
 * Platform location abstraction
 *
 * Native: expo-location (foreground + background GPS)
 * Toss 미니앱: 화면 유지 SDK + 웹 Geolocation (향후 구현)
 *
 * 이 파일만 교체하면 미니앱 전환 가능
 */

import * as Location from 'expo-location';

export { haversineKm } from '../core/pace';

export type LocationCoords = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
};

export type LocationSubscription = {
  remove: () => void;
};

/** 위치 권한 요청 (foreground) */
export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** 위치 권한 요청 (background) */
export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/** 실시간 위치 추적 시작 */
export async function watchPosition(
  onUpdate: (coords: LocationCoords) => void,
): Promise<LocationSubscription> {
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
    },
    (loc) => {
      onUpdate({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
      });
    },
  );
  return { remove: () => sub.remove() };
}

/** 현재 위치 1회 조회 */
export async function getCurrentPosition(): Promise<LocationCoords> {
  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    speed: loc.coords.speed,
  };
}
