import { useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import type { TireType } from '../constants/colors';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useLocationPermission } from './useLocationPermission';
import { buildProgram, type Tire } from '../lib/training/buildProgram';
import { logRaceStarted } from '../lib/analytics/raceEvents';

/**
 * 레이스 시작 로직 훅.
 * SetupScreen을 거치지 않고 서킷·타이어가 확정된 상태에서 바로 Countdown으로 진입할 때 사용.
 */
export function useStartRace(navigation: NavigationProp<RootStackParamList>) {
  const { ensurePermission } = useLocationPermission();
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const storeSetTire = useAppStore((s) => s.setSelectedTire);
  const storeSetCircuit = useAppStore((s) => s.setSelectedCircuitId);
  const setCurrentRaceEventId = useAppStore((s) => s.setCurrentRaceEventId);
  const user = useAuthStore((s) => s.user);

  const startRace = useCallback(
    async (circuitId: string, tire: TireType) => {
      const granted = await ensurePermission();
      if (!granted) return;

      storeSetTire(tire);
      storeSetCircuit(circuitId);

      if (user?.id && qualifyingResult) {
        const circuit = { id: circuitId, baseIntervalM: 200, baseReps: 8 };
        const appUser = {
          trainingBasePace: qualifyingResult.paceSecPerKm,
          grade: qualifyingResult.grade,
          totalSessionCount: 0,
        };
        const program = buildProgram(appUser, circuit, tire as Tire);
        logRaceStarted({
          userId: user.id,
          grade: qualifyingResult.grade,
          circuitId,
          tire: tire as Tire,
          cyclePhase: program.cyclePhase,
          program,
        })
          .then((eventId) => setCurrentRaceEventId(eventId))
          .catch(() => {});
      }

      navigation.navigate('Countdown');
    },
    [ensurePermission, qualifyingResult, storeSetTire, storeSetCircuit, setCurrentRaceEventId, user, navigation],
  );

  return { startRace };
}
