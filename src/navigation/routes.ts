/**
 * Navigation route helpers — 스크린에서 직접 navigate('Foo') 대신 이 함수를 사용.
 * 미니앱은 Granite 파일 기반 라우팅이라 이 파일만 교체하면 됨.
 */

import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList, HistoryResultData, HistoryQualifyingData } from './types';

type Nav = NavigationProp<RootStackParamList>;

export const routes = {
  toAuth: (nav: Nav) => nav.reset({ index: 0, routes: [{ name: 'Auth' }] }),
  toProfileSetup: (nav: Nav) => nav.navigate('ProfileSetup'),
  toHome: (nav: Nav) => nav.navigate('Home'),
  toRace: (nav: Nav) => nav.navigate('Race'),
  toHistory: (nav: Nav) => nav.navigate('History'),
  toProfile: (nav: Nav) => nav.navigate('Profile'),
  toProfileEdit: (nav: Nav) => nav.navigate('ProfileEdit'),
  /** skipIntro=true이면 인트로 화면 없이 바로 웜업 시작 */
  toQualifying: (nav: Nav, skipIntro?: boolean) =>
    skipIntro ? nav.navigate('Qualifying', { skipIntro: true }) : nav.navigate('Qualifying'),
  toSetup: (nav: Nav) => nav.navigate('Setup'),
  toAllCircuits: (nav: Nav, currentCircuitId: string | null) =>
    nav.navigate('AllCircuits', { currentCircuitId }),
  toCountdown: (nav: Nav) => nav.navigate('Countdown'),
  /** history를 넘기면 히스토리 조회 모드로 표시 (저장 로직 스킵) */
  toResult: (nav: Nav, history?: HistoryResultData) =>
    history ? nav.navigate('Result', { history }) : nav.navigate('Result'),
  /** history를 넘기면 히스토리 조회 모드로 표시 */
  toQualifyingPost: (nav: Nav, history?: HistoryQualifyingData) =>
    history ? nav.navigate('QualifyingPost', { history }) : nav.navigate('QualifyingPost'),
} as const;
