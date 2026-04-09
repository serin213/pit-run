import React from 'react';
import { StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef, syncTabFromRoute } from './src/navigation/navigationRef';

export default function App() {
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
  );
}
