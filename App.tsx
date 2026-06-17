import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef, syncTabFromRoute } from './src/navigation/navigationRef';
import ErrorBoundary from './src/components/ErrorBoundary';
import { flushPendingEvents } from './src/lib/analytics/raceEvents';
import { flushAllPendingMutations } from './src/api/pendingFlush';
import { useAuthStore } from './src/store/authStore';
import { getActiveRacePlan } from './src/api/racePlan';
import { useRunStore } from './src/store/runStore';
import { addDeepLinkListener, getInitialDeepLink } from './src/platform/deepLinking';
import { setPendingRunControlIntent, type RunControlIntent } from './src/navigation/runControlIntent';

const FONT_LOAD_TIMEOUT_MS = 5000;

const LIVE_ACTIVITY_LINK_PATHS = new Set([
  'pause',
  'resume',
  'stop',
  'result',
  'qualifying-result',
]);

function getPitRunPath(url: string): string | null {
  if (!url.startsWith('pitrun://')) return null;
  return url.slice('pitrun://'.length).split(/[?#]/)[0] ?? null;
}

function ensureRunningRouteForActiveRace(): boolean {
  const plan = getActiveRacePlan();
  if (!plan?.isRunning) return true;
  if (!navigationRef.isReady()) return false;
  const currentRoute = navigationRef.getCurrentRoute()?.name;
  if (currentRoute !== 'Running') {
    navigationRef.reset({ index: 0, routes: [{ name: 'Running' }] });
  }
  return true;
}

function handleLiveActivityUrl(url: string): boolean {
  const path = getPitRunPath(url);
  if (!path || !LIVE_ACTIVITY_LINK_PATHS.has(path)) return false;
  const plan = getActiveRacePlan();
  if (!plan?.isRunning) return true;

  if (path === 'pause' || path === 'resume' || path === 'stop') {
    const intent = path as RunControlIntent;
    const canApplyNow = navigationRef.isReady()
      && navigationRef.getCurrentRoute()?.name === 'Running'
      && useRunStore.getState().isRunning;
    if (canApplyNow) {
      if (intent === 'pause') useRunStore.getState().pauseRun();
      else if (intent === 'resume') useRunStore.getState().resumeRun();
      else {
        setPendingRunControlIntent(intent);
        useRunStore.getState().pauseRun();
      }
    } else {
      setPendingRunControlIntent(intent);
    }
  }

  return ensureRunningRouteForActiveRace();
}

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const pendingLiveActivityUrlRef = useRef<string | null>(null);

  const flushPendingRunNavigation = useCallback(() => {
    const pendingUrl = pendingLiveActivityUrlRef.current;
    if (pendingUrl && handleLiveActivityUrl(pendingUrl)) {
      pendingLiveActivityUrlRef.current = null;
      return;
    }
    if (!ensureRunningRouteForActiveRace()) return;
    pendingLiveActivityUrlRef.current = null;
  }, []);

  // 앱 시작 시 이전 세션에서 전송 못 한 analytics 이벤트 flush
  useEffect(() => {
    flushPendingEvents().catch(() => {});
  }, []);

  // FIX 9-3: background → active 전환 시 pending mutations flush.
  // useSyncOnLogin은 로그인 시 1회만 실행되므로, 이후 background/foreground
  // 반복 시에는 여기서 flush해야 pending queue가 비워짐.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        flushAllPendingMutations().catch(() => {});
        flushPendingEvents().catch(() => {});
      }
      if (nextState === 'active') {
        flushPendingRunNavigation();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, flushPendingRunNavigation]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const handled = handleLiveActivityUrl(url);
      const path = getPitRunPath(url);
      if (!handled && path && LIVE_ACTIVITY_LINK_PATHS.has(path) && getActiveRacePlan()?.isRunning) {
        pendingLiveActivityUrlRef.current = url;
      }
    };

    getInitialDeepLink().then(handleUrl).catch(() => {});
    const sub = addDeepLinkListener(handleUrl);
    return () => sub.remove();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Formula1-Black': require('./assets/fonts/Formula1-Black.ttf'),
    'Formula1-Bold': require('./assets/fonts/Formula1-Bold_web_0.ttf'),
    'Formula1-Regular': require('./assets/fonts/Formula1-Regular_web_0.ttf'),
    'Formula1-Italic': require('./assets/fonts/Formula1_Display-Italic_Italic.ttf'),
  });

  // 5초 안에 폰트 안 로드되면 강제 진행 (시스템 폰트 fallback)
  const [forceProceed, setForceProceed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceProceed(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || forceProceed;

  // React 트리가 마운트 되었으니 native splash 숨김
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#17171C', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, marginBottom: 16 }}>Loading...</Text>
          {fontError && (
            <Text style={{ color: '#FF6B6B', fontSize: 12, textAlign: 'center' }}>
              Font Error: {String(fontError.message ?? fontError)}
            </Text>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#17171C" />
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            syncTabFromRoute(navigationRef.current?.getCurrentRoute()?.name ?? '');
            flushPendingRunNavigation();
          }}
          onStateChange={(state) => {
            syncTabFromRoute(state?.routes[state.index]?.name ?? '');
            flushPendingRunNavigation();
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
