import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { signIn, isAppleAuthAvailable } from '../platform/auth';
import { useAuthStore } from '../store/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export default function AuthScreen({ navigation }: AuthScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hPad = 28;
  const btnW = windowW - hPad * 2;

  // 로그인 성공 시 ProfileSetup으로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('ProfileSetup');
    }
  }, [isAuthenticated, navigation]);

  const handleSignIn = async (provider: 'apple' | 'google') => {
    try {
      setLoading(true);
      setError(null);
      await signIn(provider);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} allowFontScaling={false}>
        PIT RUN
      </Text>
      <Text style={styles.subtitle} allowFontScaling={false}>
        {'Sign in to start\nyour racing journey'}
      </Text>

      <View style={[styles.btnGroup, { width: btnW }]}>
        {/* Apple — iOS only */}
        {isAppleAuthAvailable() && (
          <Pressable
            style={[styles.authBtn, styles.appleBtn]}
            onPress={() => handleSignIn('apple')}
            disabled={loading}
          >
            <Text style={styles.appleBtnText} allowFontScaling={false}>
              Continue with Apple
            </Text>
          </Pressable>
        )}

        {/* Google — both platforms */}
        <Pressable
          style={[styles.authBtn, styles.googleBtn]}
          onPress={() => handleSignIn('google')}
          disabled={loading}
        >
          <Text style={styles.googleBtnText} allowFontScaling={false}>
            Continue with Google
          </Text>
        </Pressable>
      </View>

      {error && (
        <Text style={styles.error} allowFontScaling={false}>
          {error}
        </Text>
      )}

      {/* Dev-only: skip auth */}
      {__DEV__ && (
        <Pressable
          style={styles.devSkip}
          onPress={() => navigation.replace('ProfileSetup')}
        >
          <Text style={styles.devSkipText}>DEV: Skip Auth</Text>
        </Pressable>
      )}

      {/* Bottom fade */}
      <Svg
        width={windowW}
        height={120}
        style={styles.bottomFade}
        pointerEvents="none"
      >
        <Defs>
          <SvgLinearGradient id="authFade" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
            <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={windowW} height={120} fill="url(#authFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 48,
    fontFamily: 'Formula1-Black',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 48,
  },
  btnGroup: {
    gap: 12,
  },
  authBtn: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtn: {
    backgroundColor: '#FFFFFF',
  },
  appleBtnText: {
    color: '#000000',
    fontFamily: 'Formula1-Bold',
    fontSize: 16,
  },
  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  googleBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 16,
  },
  error: {
    color: '#E03A3E',
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  devSkip: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(252,184,39,0.2)',
    borderWidth: 1,
    borderColor: '#FCB827',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devSkipText: {
    color: '#FCB827',
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
