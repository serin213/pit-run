import React, { useEffect, useState } from 'react';
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

const FONT_LOAD_TIMEOUT_MS = 5000;

export default function App() {
  const { isAuthenticated } = useAuthStore();

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
    });
    return () => sub.remove();
  }, [isAuthenticated]);

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
          onReady={() => syncTabFromRoute(navigationRef.current?.getCurrentRoute()?.name ?? '')}
          onStateChange={(state) => syncTabFromRoute(state?.routes[state.index]?.name ?? '')}
        >
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
