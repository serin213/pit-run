import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
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
import PracticeScreen from '../screens/PracticeScreen';
import PracticeResultScreen from '../screens/PracticeResultScreen';
import TabBar from '../components/TabBar';
import { useActiveTab } from './navigationRef';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useSyncOnLogin } from '../hooks/useSyncOnLogin';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function getInitialRoute(isAuthenticated: boolean, hasProfile: boolean): keyof RootStackParamList {
  // Web preview override
  if (Platform.OS === 'web') {
    const v = process.env.EXPO_PUBLIC_WEB_INITIAL;
    if (v === 'History' || v === 'Home' || v === 'Race' || v === 'Profile') return v;
  }

  if (!isAuthenticated) return 'Auth';
  if (!hasProfile) return 'ProfileSetup';
  return 'Home';
}

export default function RootNavigator() {
  const activeTab = useActiveTab();
  const showTabBar = activeTab !== undefined;
  const { isLoading, isAuthenticated, initialize, cleanup } = useAuthStore();
  const profile = useAppStore((s) => s.profile);
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const [splashDone, setSplashDone] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // 프로필이 설정되었는지 확인 (displayName이 기본값 'LEC'가 아닌 경우)
  const hasProfile = profile.displayName !== 'LEC' || profile.raceNumber !== '16';

  useEffect(() => {
    initialize();
    return () => cleanup();
  }, [initialize, cleanup]);

  // 최소 1000ms 스플래시 노출
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // auth 완료 + 타이머 완료 → dissolve fade-out
  useEffect(() => {
    if (!isLoading && splashDone) {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setSplashVisible(false));
    }
  }, [isLoading, splashDone, splashOpacity]);

  // 로그인 시 Supabase 데이터 → 로컬 동기화
  useSyncOnLogin();

  const gradeForSplash = isAuthenticated ? (qualifyingResult?.grade ?? null) : null;
  const initialRoute = getInitialRoute(isAuthenticated, hasProfile);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        initialRouteName={initialRoute}
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
          options={{ animation: 'fade', animationDuration: 150, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Running"
          component={RunningScreen}
          options={{ animation: 'fade', animationDuration: 150, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ animation: 'fade', animationDuration: 150, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Practice"
          component={PracticeScreen}
          options={{ animation: 'fade', animationDuration: 150, gestureEnabled: false }}
        />
        <Stack.Screen
          name="PracticeResult"
          component={PracticeResultScreen}
          options={{ animation: 'fade', animationDuration: 150, gestureEnabled: false }}
        />
      </Stack.Navigator>
      {showTabBar && <TabBar activeTab={activeTab} />}
      {splashVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}>
          <SplashScreen grade={gradeForSplash} />
        </Animated.View>
      )}
    </View>
  );
}
