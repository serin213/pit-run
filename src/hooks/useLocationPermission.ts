import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

let _cachedStatus: PermissionStatus = 'undetermined';

/**
 * 위치 권한 관리 훅.
 *
 * - HomeScreen 최초 진입 시 `requestOnMount: true`로 호출하면 자동 요청.
 * - 이후 러닝 시작 전 `ensurePermission()`으로 체크,
 *   거절 상태면 설정 앱 안내 Alert 표시.
 */
export function useLocationPermission(opts?: { requestOnMount?: boolean }) {
  const [status, setStatus] = useState<PermissionStatus>(_cachedStatus);
  const didRequestRef = useRef(false);

  const checkStatus = useCallback(async () => {
    const { status: s } = await Location.getForegroundPermissionsAsync();
    const mapped: PermissionStatus =
      s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'undetermined';
    _cachedStatus = mapped;
    setStatus(mapped);
    return mapped;
  }, []);

  // 마운트 시 상태 확인 + 선택적 자동 요청
  useEffect(() => {
    (async () => {
      const current = await checkStatus();
      if (opts?.requestOnMount && current === 'undetermined' && !didRequestRef.current) {
        didRequestRef.current = true;
        const { status: s } = await Location.requestForegroundPermissionsAsync();
        const mapped: PermissionStatus = s === 'granted' ? 'granted' : 'denied';
        _cachedStatus = mapped;
        setStatus(mapped);
      }
    })();
  }, [checkStatus, opts?.requestOnMount]);

  /**
   * 러닝 시작 전 호출. granted면 true 리턴.
   * 거절 상태면 Alert로 설정 안내 후 false 리턴.
   */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const current = await checkStatus();

    if (current === 'granted') return true;

    // undetermined: 아직 한번도 안 물어봤으면 요청
    if (current === 'undetermined') {
      const { status: s } = await Location.requestForegroundPermissionsAsync();
      const mapped: PermissionStatus = s === 'granted' ? 'granted' : 'denied';
      _cachedStatus = mapped;
      setStatus(mapped);
      return mapped === 'granted';
    }

    // denied: 설정 앱으로 안내
    return new Promise((resolve) => {
      Alert.alert(
        'Location Permission Required',
        'GPS is needed to track your running distance. Please enable location access in Settings.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
              resolve(false);
            },
          },
        ],
      );
    });
  }, [checkStatus]);

  return { status, ensurePermission };
}
