import React, { useId, useMemo } from 'react';
import { BlurView } from 'expo-blur';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import BackButton from '../components/BackButton';
import TireIcon from '../components/TireIcon';
import CircuitMini from '../components/CircuitMini';
import GradientCtaButton from '../components/GradientCtaButton';
import { CARD_FILL } from '../components/GradientCardBorder';
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from '../store/appStore';
import type { TireType } from '../constants/colors';
import type { NextRaceScreenProps } from '../navigation/types';
import { radius } from '../constants/radius';

const H_PAD = 20;
const CTA_AREA_H = 164;
/** 스페이서로 safeTop 처리 후 — 퀄리파잉 인트로 타이틀과 동일하게 safeTop+63 */
const TITLE_TOP_PADDING = 63;

// 홈 서킷 카드와 동일한 내부 상수
const CIRCUIT_TOP_IN_CARD = 315; // TireIcon bottom(246+41=287) + 28px gap

const TIRE_COPY: Record<TireType, string> = {
  soft: 'Short run, Long rest',
  medium: 'Balanced',
  hard: 'Long run, Short rest',
  wet: 'Easy and Gentle',
};

export default function NextRaceScreen({ navigation }: NextRaceScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();

  const rawId = useId();
  const gradId = rawId.replace(/[^a-zA-Z0-9]/g, '_');

  const selectedCircuitId = useAppStore((s) => s.selectedCircuitId);
  const selectedTire = useAppStore((s) => s.selectedTire);
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const paceRecords = useAppStore((s) => s.paceRecords);

  const circuit = useMemo(() => {
    const picked = selectedCircuitId ? CIRCUITS.find((c) => c.id === selectedCircuitId) : undefined;
    return picked ?? CIRCUITS.find((c) => c.id === 'monaco') ?? CIRCUITS[0];
  }, [selectedCircuitId]);

  const paceSec = useMemo(() => {
    if (qualifyingResult) return qualifyingResult.paceSecPerKm;
    if (Number.isFinite(paceRecords.bestEver) && paceRecords.bestEver < Number.POSITIVE_INFINITY) {
      return paceRecords.bestEver;
    }
    return 300;
  }, [qualifyingResult, paceRecords.bestEver]);

  const raceTimeStr = useMemo(() => {
    const totalS = Math.round(paceSec * circuit.distanceKm);
    return `${Math.max(1, Math.round(totalS / 60))}min`;
  }, [paceSec, circuit.distanceKm]);

  const cardW = windowW - H_PAD * 2;
  const ctaRowW = cardW;

  // 홈과 동일한 서킷 SVG 크기 계산
  const circuitSvgLeft = 45;
  const circuitW = cardW - 90;
  const circuitVB = circuit.viewBox ?? { width: 286, height: 185 };
  const circuitH = Math.round(circuitW * circuitVB.height / circuitVB.width);
  const cardH = CIRCUIT_TOP_IN_CARD + circuitH + 24;

  const tireLine = TIRE_COPY[selectedTire] ?? TIRE_COPY.soft;

  return (
    <View style={styles.root}>
      <View style={{ height: safeTop, backgroundColor: '#17171C' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: H_PAD, paddingTop: TITLE_TOP_PADDING, paddingBottom: CTA_AREA_H + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} allowFontScaling={false}>
          Next race
        </Text>
        <Text style={styles.screenSub} allowFontScaling={false}>
          Picked for your qualifying pace.
        </Text>

        {/* ── 서킷 카드 (홈과 동일 구조, 버튼 제외) ── */}
        <View style={{ width: cardW, height: cardH, ...radius.lg, marginTop: 36 }}>
          <Svg width={cardW} height={cardH} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={cardH}>
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
              </SvgLinearGradient>
            </Defs>
            <Rect x={0.25} y={0.25} width={cardW - 0.5} height={cardH - 0.5} rx={radius.lg.borderRadius - 0.25} ry={radius.lg.borderRadius - 0.25} fill="none" stroke={`url(#${gradId})`} strokeWidth={0.5} />
          </Svg>
          <View style={{ position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5, borderRadius: radius.lg.borderRadius - 0.5, borderCurve: radius.lg.borderCurve, backgroundColor: CARD_FILL, overflow: 'hidden' }}>

            <Text style={styles.circuitName} numberOfLines={1} allowFontScaling={false}>
              {circuit.displayName.toUpperCase()}
            </Text>

            <Text style={[styles.statLabel, { top: 88 }]} allowFontScaling={false}>DISTANCE</Text>
            <Text style={[styles.statValue, { top: 110 }]} allowFontScaling={false}>
              {circuit.distanceKm.toFixed(1)}km
            </Text>

            <Text style={[styles.statLabel, { top: 154 }]} allowFontScaling={false}>RACE TIME</Text>
            <Text style={[styles.statValue, { top: 176 }]} allowFontScaling={false}>
              {raceTimeStr}
            </Text>

            <Text style={[styles.statLabel, { top: 220 }]} allowFontScaling={false}>TYRE</Text>

            <View style={{ position: 'absolute', left: 26, top: 246 }}>
              <TireIcon type={selectedTire} />
            </View>

            <View style={{ position: 'absolute', left: circuitSvgLeft, top: CIRCUIT_TOP_IN_CARD, width: circuitW, height: circuitH }}>
              <CircuitMini
                trackPath={circuit.trackPath}
                viewBox={circuitVB}
                width={circuitW}
                height={circuitH}
              />
            </View>

          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaContainer, { height: CTA_AREA_H }]} pointerEvents="box-none">
        <Svg
          width={windowW}
          height={CTA_AREA_H}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id="nextRaceFade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="66%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={windowW} height={CTA_AREA_H} fill="url(#nextRaceFade)" />
        </Svg>
        <View style={[styles.ctaRowWrap, { left: H_PAD, right: H_PAD, bottom: 40 }]}>
          <GradientCtaButton
            variant="dual"
            width={ctaRowW}
            onPressLeft={() => navigation.navigate('Home')}
            onPressRight={() => navigation.navigate('Setup')}
          />
        </View>
      </View>

      <BackButton onPress={() => navigation.navigate('Home')} />
      <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop + 63, zIndex: 1000 }} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'flex-start',
  },
  screenTitle: {
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    color: '#FFFFFF',
    letterSpacing: 1.8,
    includeFontPadding: false,
    marginLeft: 4,
  },
  screenSub: {
    marginTop: 12,
    marginLeft: 4,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  circuitName: {
    position: 'absolute',
    left: 24,
    top: 24,
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  statLabel: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  statValue: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  ctaRowWrap: {
    position: 'absolute',
  },
});
