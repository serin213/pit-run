import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef, syncTabFromRoute } from './src/navigation/navigationRef';
import ErrorBoundary from './src/components/ErrorBoundary';
import { flushPendingEvents } from './src/lib/analytics/raceEvents';

export default function App() {
  // 앱 시작 시 이전 세션에서 전송 못 한 analytics 이벤트 flush
  useEffect(() => {
    flushPendingEvents().catch(() => {});
  }, []);

  const [fontsLoaded] = useFonts({
    'Formula1-Black': require('./assets/fonts/Formula1-Black.ttf'),
    'Formula1-Bold': require('./assets/fonts/Formula1-Bold_web_0.ttf'),
    'Formula1-Regular': require('./assets/fonts/Formula1-Regular_web_0.ttf'),
    'Formula1-Italic': require('./assets/fonts/Formula1_Display-Italic_Italic.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#17171C' }} />
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
