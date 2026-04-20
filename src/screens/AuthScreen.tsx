import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Defs,
  Path,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { signIn } from '../platform/auth';
import { useAuthStore } from '../store/authStore';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;

const FLAG_PNG = require('../../assets/race-flag.png');

const BTN_H = 54;
const BTN_RADIUS = 16;
const H_PAD = 20;

// ─── Inline SVG components ───────────────────────────────────────────────────

function TextLogoSvg({ width }: { width: number }) {
  const height = Math.round((29 / 177) * width);
  return (
    <Svg width={width} height={height} viewBox="0 0 177 29" fill="none">
      <Path d="M170.348 28.8019C168.705 28.8019 167.298 28.391 166.127 27.5691C164.981 26.7224 163.724 25.527 162.354 23.9829L155.431 15.1813C155.137 14.8082 154.538 15.0158 154.538 15.4905V26.8162C154.538 27.6447 153.866 28.3162 153.038 28.3162H146.325C145.497 28.3162 144.825 27.6447 144.825 26.8162V6.83624C144.825 5.69064 145 4.69447 145.348 3.84772C145.722 2.97607 146.195 2.26629 146.768 1.7184C147.365 1.1456 148.063 0.722226 148.86 0.448277C149.657 0.149426 150.478 0 151.325 0C152.67 0 153.828 0.298852 154.799 0.896556C155.796 1.46936 156.842 2.39082 157.937 3.66094L165.493 13.4135C165.785 13.7902 166.389 13.5839 166.389 13.1073V1.79885C166.389 0.970423 167.06 0.298851 167.889 0.298851H174.601C175.43 0.298851 176.101 0.970424 176.101 1.79885V23.0863C176.101 24.1323 175.927 25.0289 175.578 25.776C175.23 26.4982 174.781 27.0835 174.233 27.5318C173.686 27.98 173.063 28.3038 172.366 28.503C171.668 28.7023 170.996 28.8019 170.348 28.8019Z" fill="#E03A3E" />
      <Path d="M127.825 28.8766C125.858 28.8766 123.977 28.5777 122.184 27.98C120.391 27.3823 118.822 26.5107 117.477 25.3651C116.133 24.2195 115.062 22.7875 114.265 21.0691C113.468 19.3258 113.069 17.321 113.069 15.0547V1.79883C113.069 0.970401 113.741 0.298828 114.569 0.298828H121.656C122.484 0.298828 123.156 0.970401 123.156 1.79883V14.4943C123.156 15.9139 123.579 17.0844 124.426 18.0058C125.272 18.9273 126.406 19.388 127.825 19.388C129.245 19.388 130.378 18.9273 131.225 18.0058C132.071 17.0844 132.495 15.9139 132.495 14.4943V1.79883C132.495 0.970399 133.166 0.298828 133.995 0.298828H141.081C141.909 0.298828 142.581 0.970401 142.581 1.79883V15.0547C142.581 17.321 142.183 19.3258 141.386 21.0691C140.589 22.7875 139.518 24.2195 138.173 25.3651C136.828 26.5107 135.259 27.3823 133.466 27.98C131.673 28.5777 129.793 28.8766 127.825 28.8766Z" fill="#E03A3E" />
      <Path d="M110.174 26.7112C110.674 27.3696 110.205 28.3162 109.378 28.3162H100.655C100.173 28.3162 99.7208 28.0848 99.4388 27.6941L93.1352 18.9613C92.8512 18.5679 92.2298 18.7688 92.2298 19.2539V26.8162C92.2298 27.6447 91.5582 28.3162 90.7298 28.3162H84.0171C83.1887 28.3162 82.5171 27.6447 82.5171 26.8162V1.79883C82.5171 0.9704 83.1887 0.298828 84.0171 0.298828H101.681C103.275 0.298828 104.682 0.560324 105.902 1.08332C107.123 1.5814 108.131 2.24137 108.928 3.06321C109.75 3.88506 110.36 4.83142 110.759 5.90231C111.182 6.97319 111.394 8.05653 111.394 9.15233C111.394 10.1734 111.219 11.182 110.871 12.1782C110.547 13.1495 110.049 14.0336 109.376 14.8305C108.729 15.6026 107.907 16.2625 106.911 16.8104C106.137 17.2358 105.274 17.5487 104.32 17.7489C103.945 17.8276 103.762 18.2721 103.993 18.5773L110.174 26.7112ZM92.4726 9.15233C92.1322 9.15233 91.8562 9.42829 91.8562 9.76871C91.8562 10.1091 92.1322 10.3851 92.4726 10.3851H100.766C101.106 10.3851 101.382 10.1091 101.382 9.76871C101.382 9.42829 101.106 9.15233 100.766 9.15233H92.4726Z" fill="#E03A3E" />
      <Path d="M61.828 26.8162C61.828 27.6447 61.1565 28.3162 60.328 28.3162H53.6153C52.7869 28.3162 52.1153 27.6447 52.1153 26.8162V9.89083C52.1153 9.33854 51.6676 8.89083 51.1153 8.89083H43.3423C42.5139 8.89083 41.8423 8.21926 41.8423 7.39083V1.79883C41.8423 0.970401 42.5139 0.298828 43.3423 0.298828H70.5637C71.3921 0.298828 72.0637 0.970401 72.0637 1.79883V7.39083C72.0637 8.21926 71.3921 8.89083 70.5637 8.89083H62.828C62.2757 8.89083 61.828 9.33855 61.828 9.89083V26.8162Z" fill="#E03A3E" />
      <Path d="M39.6082 26.8162C39.6082 27.6447 38.9366 28.3162 38.1082 28.3162H31.3955C30.5671 28.3162 29.8955 27.6447 29.8955 26.8162V1.79883C29.8955 0.9704 30.5671 0.298828 31.3955 0.298828H38.1082C38.9366 0.298828 39.6082 0.970401 39.6082 1.79883V26.8162Z" fill="#E03A3E" />
      <Path d="M9.33913 26.8162C9.33913 27.6447 8.66756 28.3162 7.83913 28.3162H1.5C0.671572 28.3162 0 27.6447 0 26.8162V1.79883C0 0.9704 0.671573 0.298828 1.5 0.298828H18.6783C20.2721 0.298828 21.6543 0.560324 22.8248 1.08332C23.9953 1.5814 24.9666 2.25382 25.7386 3.10057C26.5107 3.94732 27.0835 4.91859 27.457 6.01438C27.8306 7.08527 28.0174 8.18106 28.0174 9.30175C28.0174 10.4224 27.8306 11.5431 27.457 12.6638C27.0835 13.7845 26.5107 14.7932 25.7386 15.6897C24.9666 16.5614 23.9953 17.2711 22.8248 17.819C21.6543 18.3669 20.2721 18.6409 18.6783 18.6409H10.3391C9.78685 18.6409 9.33913 19.0886 9.33913 19.6409V26.8162ZM9.33913 9.46986C9.33913 9.78964 9.59837 10.0489 9.91816 10.0489H17.9125C18.2322 10.0489 18.4915 9.78964 18.4915 9.46986C18.4915 9.15007 18.2322 8.89083 17.9125 8.89083H9.91816C9.59837 8.89083 9.33913 9.15007 9.33913 9.46986Z" fill="#E03A3E" />
    </Svg>
  );
}

function AppleLogoSvg({ height: h, color }: { height: number; color: string }) {
  const w = Math.round((29 / 27) * h);
  return (
    <Svg width={w} height={h} viewBox="0 0 29 27" fill="none">
      <Path d="M14.4026 7.85927C15.3202 7.85927 16.4705 7.2663 17.1555 6.47569C17.7759 5.7592 18.2282 4.75858 18.2282 3.75795C18.2282 3.62207 18.2153 3.48618 18.1895 3.375C17.1684 3.41206 15.9406 4.02973 15.2039 4.8574C14.6223 5.48742 14.0924 6.47569 14.0924 7.48867C14.0924 7.63691 14.1182 7.78515 14.1311 7.83456C14.1958 7.84691 14.2992 7.85927 14.4026 7.85927ZM11.1714 22.8068C12.4251 22.8068 12.9809 22.0039 14.5447 22.0039C16.1345 22.0039 16.4834 22.7821 17.8793 22.7821C19.2493 22.7821 20.1669 21.5715 21.0329 20.3856C22.0022 19.0267 22.4029 17.6925 22.4287 17.6308C22.3383 17.6061 19.7146 16.5807 19.7146 13.7024C19.7146 11.207 21.7825 10.0829 21.8988 9.9964C20.5288 8.11869 18.448 8.06927 17.8793 8.06927C16.3413 8.06927 15.0876 8.95871 14.2992 8.95871C13.4461 8.95871 12.3217 8.11869 10.9905 8.11869C8.45725 8.11869 5.88525 10.1199 5.88525 13.9001C5.88525 16.2472 6.84167 18.7302 8.01781 20.3362C9.02593 21.695 9.90481 22.8068 11.1714 22.8068Z" fill={color} />
    </Svg>
  );
}

function GoogleLogoSvg({ height: h }: { height: number }) {
  const w = Math.round((26 / 24) * h);
  return (
    <Svg width={w} height={h} viewBox="0 0 26 24" fill="none">
      <Path fillRule="evenodd" clipRule="evenodd" d="M21.5942 12.2044C21.5942 11.5663 21.5343 10.9526 21.423 10.3635H12.5547V13.8449H17.6223C17.404 14.9699 16.7406 15.9231 15.7434 16.5613V18.8194H18.7865C20.567 17.2526 21.5942 14.9453 21.5942 12.2044Z" fill="#4285F4" />
      <Path fillRule="evenodd" clipRule="evenodd" d="M12.5548 21C15.0972 21 17.2286 20.1941 18.7866 18.8195L15.7434 16.5613C14.9003 17.1013 13.8217 17.4204 12.5548 17.4204C10.1023 17.4204 8.02645 15.8372 7.286 13.71H4.14014V16.0418C5.68953 18.9831 8.87391 21 12.5548 21Z" fill="#34A853" />
      <Path fillRule="evenodd" clipRule="evenodd" d="M7.28607 13.7101C7.09775 13.1701 6.99075 12.5933 6.99075 12.0001C6.99075 11.4069 7.09775 10.8301 7.28607 10.2901V7.95825H4.14021C3.50248 9.17325 3.13867 10.5478 3.13867 12.0001C3.13867 13.4523 3.50248 14.8269 4.14021 16.0419L7.28607 13.7101Z" fill="#FBBC05" />
      <Path fillRule="evenodd" clipRule="evenodd" d="M12.5548 6.57955C13.9372 6.57955 15.1785 7.03364 16.1543 7.92546L18.8551 5.34409C17.2244 3.89182 15.0929 3 12.5548 3C8.87391 3 5.68953 5.01682 4.14014 7.95818L7.286 10.29C8.02645 8.16273 10.1023 6.57955 12.5548 6.57955Z" fill="#EA4335" />
    </Svg>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AuthScreen({ navigation }: AuthScreenProps) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const safeBottom = useSafeBottom();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigation.replace('ProfileSetup');
  }, [isAuthenticated, navigation]);

  const handleSignIn = async (provider: 'apple' | 'google') => {
    try {
      setLoading(true);
      setError(null);
      await signIn(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  // Radial gradient: size 1354×1219, top-left at (-84, -542)
  // → center at (-84 + 677, -542 + 609.5) = (593, 67.5)
  const gCx = 593;
  const gCy = 67.5;

  return (
    <View style={s.container}>

      {/* Background radial gradient — 10% opacity */}
      <Svg
        width={windowW}
        height={windowH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <SvgRadialGradient
            id="bgGrad"
            cx={gCx}
            cy={gCy}
            rx={677}
            ry={609.5}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#E03A3E" stopOpacity="1" />
            <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
          </SvgRadialGradient>
        </Defs>
        <Rect x={0} y={0} width={windowW} height={windowH} fill="url(#bgGrad)" opacity={0.1} />
      </Svg>

      {/* Bottom content — stacks upward from safe bottom */}
      <View style={[s.bottomBlock, { paddingBottom: safeBottom + 40 }]}>

        {/* Flag + Text logo + Subtitle */}
        <Image source={FLAG_PNG} style={s.flag} resizeMode="contain" />
        <View style={s.gap12} />
        <TextLogoSvg width={176} />
        <View style={s.gap24} />
        <Text style={s.subtitle} allowFontScaling={false}>
          {'Sign in to start\nyour racing journey'}
        </Text>

        <View style={s.gap72} />

        {/* Buttons */}
        {Platform.OS === 'ios' ? (
          <>
            {/* iOS: Apple primary (white) */}
            <Pressable
              style={[s.btn, s.primaryBtn]}
              onPress={() => handleSignIn('apple')}
              disabled={loading}
            >
              <AppleLogoSvg height={27} color="#17171C" />
              <View style={s.iconGap} />
              <Text style={[s.btnText, s.darkText]} allowFontScaling={false}>
                Start with Apple
              </Text>
            </Pressable>
            <View style={s.gap12} />
            {/* iOS: Google secondary (dark) */}
            <Pressable
              style={[s.btn, s.secondaryBtn]}
              onPress={() => handleSignIn('google')}
              disabled={loading}
            >
              <GoogleLogoSvg height={24} />
              <View style={s.iconGap} />
              <Text style={[s.btnText, s.lightText]} allowFontScaling={false}>
                Start with Google
              </Text>
            </Pressable>
          </>
        ) : (
          /* Android: Google primary (white) only */
          <Pressable
            style={[s.btn, s.primaryBtn]}
            onPress={() => handleSignIn('google')}
            disabled={loading}
          >
            <GoogleLogoSvg height={24} />
            <View style={s.iconGap} />
            <Text style={[s.btnText, s.darkText]} allowFontScaling={false}>
              Start with Google
            </Text>
          </Pressable>
        )}

        {error ? (
          <Text style={s.error} allowFontScaling={false}>{error}</Text>
        ) : null}
      </View>

      {/* Dev-only: skip auth */}
      {__DEV__ && (
        <Pressable
          style={s.devSkip}
          onPress={() => navigation.replace('ProfileSetup')}
        >
          <Text style={s.devSkipText}>DEV: Skip Auth</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
    justifyContent: 'flex-end',
  },
  bottomBlock: {
    paddingHorizontal: H_PAD,
  },
  flag: {
    width: 36,
    height: 36,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,       // 20 × 1.3
    letterSpacing: -0.4,  // -2% of 20
  },
  btn: {
    height: BTN_H,
    borderRadius: BTN_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  btnText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    letterSpacing: -0.4,
  },
  darkText: {
    color: '#17171C',
  },
  lightText: {
    color: '#FFFFFF',
  },
  iconGap: {
    width: 8,
  },
  gap12: { height: 12 },
  gap24: { height: 20 },
  gap72: { height: 42 },
  error: {
    color: '#E03A3E',
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    marginTop: 12,
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
});
