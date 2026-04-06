import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  ProfileSetup: undefined;
  Home: undefined;
  Race: undefined;
  History: undefined;
  Profile: undefined;
  ProfileEdit: undefined;
  Qualifying: undefined;
  QualifyingPost: undefined;
  NextRace: undefined;
  Setup: undefined;
  AllCircuits: { currentCircuitId: string | null };
  Countdown: undefined;
  Running: undefined;
  Result: undefined;
};

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
