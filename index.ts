import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import {
  defineBackgroundLocationTask,
  probeBackgroundTaskRegistration,
  cleanupStaleBackgroundTask,
} from './src/platform/locationTask';
import App from './App';

// Splash screen control:
// - preventAutoHide: React 마운트까지 splash 유지
// - 8s fallback: JS가 아예 부팅 못해도 splash가 무한히 안 남도록
SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

// Must run before registerRootComponent — TaskManager requires top-level registration.
// 호출 후 즉시 isTaskRegisteredAsync로 등록 성공 여부 probe → gpsDiag.earlyReg 기록.
defineBackgroundLocationTask();
probeBackgroundTaskRegistration().catch(() => {});

// 부팅 시 stale background task 정리 — 앱 swipe kill 후 OS 레벨에 남은 task가
// 잠금화면 GPS 아이콘/사운드 유지하는 문제 1차 방어선. plan이 없으면 stop.
cleanupStaleBackgroundTask().catch(() => {});

registerRootComponent(App);
