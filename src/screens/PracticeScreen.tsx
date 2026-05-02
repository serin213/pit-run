import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '../hooks/useSafeTop';
import { usePracticeDistance } from '../hooks/usePracticeDistance';
import { useSupabaseSession } from '../hooks/useSupabaseSessions';
import type { PracticeScreenProps } from '../navigation/types';

const RUN_ICON = require('../../assets/icons/qualifying-run-756777.png');
const PLAY_BUTTON = require('../../assets/control-buttons/play-red.png');
const PAUSE_BUTTON = require('../../assets/control-buttons/pause-red.png');
const STOP_BUTTON = require('../../assets/control-buttons/stop-red.png');

const ACCENT = '#E03A3E';
const CONTROL_BUTTON_SIZE = 76;
const CONTROLS_TOP_SPACING = 20;
const CONTROLS_BOTTOM_SPACING = 32;

export default function PracticeScreen({ navigation }: PracticeScreenProps) {
  const safeTop = useSafeTop();
  const insets = useSafeAreaInsets();

  const [isPaused, setIsPaused] = useState(false);
  const distKm = usePracticeDistance(isPaused);
  const { startSession, endSession } = useSupabaseSession();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startSession('practice').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerFontSize = 120;
  const badgeGroupTop = safeTop + 164;

  const controlsBottomPadding = Math.max(insets.bottom, 0) + CONTROLS_BOTTOM_SPACING;

  return (
    <View style={styles.container}>
      {/* Badge + 거리 — Qualifying warmup 화면과 동일 레이아웃 */}
      <View style={[styles.timerGroup, { top: badgeGroupTop }]}>
        <View style={styles.labelBadge}>
          <Image source={RUN_ICON} style={{ width: 18, height: 20 }} resizeMode="contain" />
          <Text style={styles.labelBadgeText}>Practice</Text>
        </View>
        <Text
          style={[styles.timerText, { fontSize: timerFontSize, marginTop: 8 }]}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {distKm.toFixed(2)}
        </Text>
      </View>

      {/* 컨트롤 버튼 — RunningScreen 패턴과 동일 */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: CONTROLS_TOP_SPACING,
          paddingBottom: controlsBottomPadding,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        {isPaused ? (
          <>
            <Pressable onPress={() => {
              endSession({
                status: 'completed',
                total_dist_km: distKm,
                total_time_ms: Date.now() - startTimeRef.current,
              }).catch(() => {});
              navigation.replace('PracticeResult', { distanceKm: distKm });
            }}>
              <Image source={STOP_BUTTON} style={styles.controlButton} resizeMode="contain" />
            </Pressable>
            <Pressable onPress={() => setIsPaused(false)}>
              <Image source={PLAY_BUTTON} style={styles.controlButton} resizeMode="contain" />
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => setIsPaused(true)}>
            <Image source={PAUSE_BUTTON} style={styles.controlButton} resizeMode="contain" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  timerGroup: {
    position: 'absolute',
    left: 36,
    right: 36,
    alignItems: 'center',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224,58,62,0.3)',
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  labelBadgeText: {
    color: ACCENT,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  timerText: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: 'Formula1-Black',
    letterSpacing: 5,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  controlButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
  },
});
