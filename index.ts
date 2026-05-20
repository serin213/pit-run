import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { defineBackgroundLocationTask } from './src/platform/locationTask';
import App from './App';

// Splash screen control:
// - preventAutoHide: React 마운트까지 splash 유지
// - 8s fallback: JS가 아예 부팅 못해도 splash가 무한히 안 남도록
SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

// Must run before registerRootComponent — TaskManager requires top-level registration
defineBackgroundLocationTask();

registerRootComponent(App);
