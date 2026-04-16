import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import AuthScreen from '../screens/AuthScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import HomeScreen from '../screens/HomeScreen';
import RaceScreen from '../screens/RaceScreen';
import HistoryScreen from '../screens/HistoryScreen';
import QualifyingScreen from '../screens/QualifyingScreen';
import QualifyingPostScreen from '../screens/QualifyingPostScreen';
import NextRaceScreen from '../screens/NextRaceScreen';
import SetupScreen from '../screens/SetupScreen';
import AllCircuitsScreen from '../screens/AllCircuitsScreen';
import CountdownScreen from '../screens/CountdownScreen';
import RunningScreen from '../screens/RunningScreen';
import ResultScreen from '../screens/ResultScreen';
import TabBar from '../components/TabBar';
import { useActiveTab } from './navigationRef';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** 웹 미리보기: `npm run web:history` 또는 `EXPO_PUBLIC_WEB_INITIAL=History expo start --web` */
function getInitialRouteName(): keyof RootStackParamList {
  if (Platform.OS !== 'web') return 'Auth';
  const v = process.env.EXPO_PUBLIC_WEB_INITIAL;
  if (v === 'History' || v === 'Home' || v === 'Race' || v === 'Profile') return v;
  return 'Auth';
}

export default function RootNavigator() {
  const activeTab = useActiveTab();
  const showTabBar = activeTab !== undefined;
  const { isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#17171C', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E03A3E" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#17171C' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ gestureEnabled: false, animation: 'none' }}
        />
        <Stack.Screen name="Race" component={RaceScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
        <Stack.Screen name="Qualifying" component={QualifyingScreen} />
        <Stack.Screen name="QualifyingPost" component={QualifyingPostScreen} />
        <Stack.Screen name="NextRace" component={NextRaceScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="AllCircuits" component={AllCircuitsScreen} />
        <Stack.Screen
          name="Countdown"
          component={CountdownScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Running"
          component={RunningScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
      </Stack.Navigator>
      {showTabBar && <TabBar activeTab={activeTab} />}
    </View>
  );
}
