import React from 'react';
import { StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import SafeAreaOverlay from './src/components/SafeAreaOverlay';

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
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      {/* iOS status bar + home indicator overlay — outside NavigationContainer to render above all screens */}
      <SafeAreaOverlay />
    </SafeAreaProvider>
  );
}
