import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QualifyingGrade } from '../types';
import type { LapEntry } from '../types/run';

export type HistoryResultData = {
  distKm: number;
  elapsedMs: number;
  circuitId?: string;
  difficulty?: string | null;
  // 히스토리 결과 그래프용 랩 로그(run_sessions.payload.lapLog 복원). 구버전 기록엔 없음.
  lapLog?: LapEntry[];
};

export type HistoryQualifyingData = {
  grade: QualifyingGrade;
  paceSec: number;
};

export type RootStackParamList = {
  Auth: undefined;
  ProfileSetup: undefined;
  Home: undefined;
  Race: undefined;
  History: undefined;
  Profile: undefined;
  ProfileEdit: undefined;
  Qualifying: { skipIntro?: boolean } | undefined;
  QualifyingPost: { history?: HistoryQualifyingData } | undefined;
  NextRace: undefined;
  Setup: undefined;
  AllCircuits: { currentCircuitId: string | null };
  Countdown: undefined;
  Running: undefined;
  Result: { history?: HistoryResultData } | undefined;
  Practice: undefined;
  PracticeResult: { distanceKm: number; fromHistory?: boolean };
};

export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type ProfileSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RaceScreenProps = NativeStackScreenProps<RootStackParamList, 'Race'>;
export type HistoryScreenProps = NativeStackScreenProps<RootStackParamList, 'History'>;
export type QualifyingScreenProps = NativeStackScreenProps<RootStackParamList, 'Qualifying'>;
export type QualifyingPostScreenProps = NativeStackScreenProps<RootStackParamList, 'QualifyingPost'>;
export type NextRaceScreenProps = NativeStackScreenProps<RootStackParamList, 'NextRace'>;
export type SetupScreenProps = NativeStackScreenProps<RootStackParamList, 'Setup'>;
export type AllCircuitsScreenProps = NativeStackScreenProps<RootStackParamList, 'AllCircuits'>;
export type CountdownScreenProps = NativeStackScreenProps<RootStackParamList, 'Countdown'>;
export type RunningScreenProps = NativeStackScreenProps<RootStackParamList, 'Running'>;
export type ResultScreenProps = NativeStackScreenProps<RootStackParamList, 'Result'>;
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
export type ProfileEditScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;
export type PracticeScreenProps = NativeStackScreenProps<RootStackParamList, 'Practice'>;
export type PracticeResultScreenProps = NativeStackScreenProps<RootStackParamList, 'PracticeResult'>;
