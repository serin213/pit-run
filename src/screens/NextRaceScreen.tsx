import React, { useMemo, useState } from 'react';
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
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from '../store/appStore';
import type { TireType } from '../constants/colors';
import type { NextRaceScreenProps } from '../navigation/types';

const H_PAD = 28;
const FIGMA_CARD_W = 346;
const TIRE_ROW_TOP = 266;
/** 타이어 설명 줄과 서킷 트랙 사이 */
const GAP_TYRE_TO_TRACK = 52;
/** 트랙과 카드 하단 */
const TRACK_BOTTOM_INSET = 48;
const CTA_AREA_H = 164;
/** 스페이서로 safeTop 처리 후 — 퀄리파잉 인트로 타이틀과 동일하게 safeTop+63 */
const TITLE_TOP_PADDING = 63;

const TIRE_COPY: Record<TireType, string> = {
  soft: 'Short run, Long rest',
  medium: 'Balanced',
  hard: 'Long run, Short rest',
  wet: 'Easy and Gentle',
};

export default function NextRaceScreen({ navigation }: NextRaceScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();

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
  const scale = cardW / FIGMA_CARD_W;
  const trackW = 253 * scale;
  const trackH = 102.22 * scale;
  const circuitVB = circuit.viewBox ?? { width: 286, height: 185 };

  const tireLine = TIRE_COPY[selectedTire] ?? TIRE_COPY.soft;

  const [tireRowH, setTireRowH] = useState(41);
  const trackTop = TIRE_ROW_TOP + tireRowH + GAP_TYRE_TO_TRACK;
  const cardHeight = trackTop + trackH + TRACK_BOTTOM_INSET;

  return (
    <View style={styles.root}>
      <View style={{ height: safeTop, backgroundColor: '#17171C' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: H_PAD, paddingTop: TITLE_TOP_PADDING, paddingBottom: CTA_AREA_H + 24 },
        ]}
        showsVerticalScrollIndicator
      >
        <Text style={styles.screenTitle} allowFontScaling={false}>
          Next race
        </Text>
        <Text style={styles.screenSub} allowFontScaling={false}>
          Picked for your qualifying pace.
        </Text>

        <View style={[styles.card, { width: cardW, height: cardHeight }]}>
          <Text style={styles.circuitName} allowFontScaling={false}>
            {circuit.displayName.toUpperCase()}
          </Text>

          <Text style={[styles.statLabel, { top: 100 }]} allowFontScaling={false}>
            DISTANCE
          </Text>
          <Text style={[styles.statValue, { top: 122 }]} allowFontScaling={false}>
            {circuit.distanceKm.toFixed(1)}km
          </Text>

          <Text style={[styles.statLabel, { top: 170 }]} allowFontScaling={false}>
            RACE TIME
          </Text>
          <Text style={[styles.statValue, { top: 192 }]} allowFontScaling={false}>
            {raceTimeStr}
          </Text>

          <Text style={[styles.statLabel, { top: 240 }]} allowFontScaling={false}>
            TYRE
          </Text>

          <View
            style={styles.tireRow}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (Math.abs(h - tireRowH) > 0.5) setTireRowH(h);
            }}
          >
            <TireIcon type={selectedTire} />
            <Text style={styles.tireDesc} allowFontScaling={false}>
              {tireLine}
            </Text>
          </View>

          <View style={[styles.trackBox, { left: 44, top: trackTop, width: trackW, height: trackH }]}>
            <CircuitMini
              trackPath={circuit.trackPath}
              viewBox={circuitVB}
              width={trackW}
              height={trackH}
            />
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
        <View style={[styles.ctaRowWrap, { left: H_PAD, right: H_PAD, bottom: 34 }]}>
          <GradientCtaButton
            variant="dual"
            width={ctaRowW}
            onPressLeft={() => navigation.navigate('Home')}
            onPressRight={() => navigation.navigate('Setup')}
          />
        </View>
      </View>

      <BackButton onPress={() => navigation.navigate('Home')} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: safeTop + 63,
          backgroundColor: '#17171C',
          zIndex: 1000,
        }}
      />
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
  },
  screenSub: {
    marginTop: 12,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  card: {
    marginTop: 36,
    backgroundColor: '#202028',
    borderRadius: 12,
    overflow: 'hidden',
  },
  circuitName: {
    position: 'absolute',
    left: 28,
    top: 32,
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  statLabel: {
    position: 'absolute',
    left: 28,
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
    left: 28,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  tireRow: {
    position: 'absolute',
    left: 32,
    right: 28,
    top: TIRE_ROW_TOP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tireDesc: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    opacity: 0.45,
    includeFontPadding: false,
  },
  trackBox: {
    position: 'absolute',
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
