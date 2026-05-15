import { COLORS, PALETTE } from '../constants/colors';
import React, { useMemo } from 'react';
import TopSafeBlurOverlay from '../components/TopSafeBlurOverlay';
import TopSafeSpacer from '../components/TopSafeSpacer';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import BackButton from '../components/BackButton';
import TireIcon from '../components/TireIcon';
import CircuitMini from '../components/CircuitMini';
import GradientCtaButton from '../components/GradientCtaButton';
import CtaFadeBackground, { CTA_AREA_HEIGHT } from '../components/CtaFadeBackground';
import GradientCardBorder from '../components/GradientCardBorder';
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from '../store/appStore';
import type { TireType } from '../constants/colors';
import type { NextRaceScreenProps } from '../navigation/types';
import { radius } from '../constants/radius';

const H_PAD = 20;
const CTA_AREA_H = CTA_AREA_HEIGHT;
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
      <TopSafeSpacer safeTop={safeTop} />
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
        <GradientCardBorder
          style={{ width: cardW, height: cardH, marginTop: 36 }}
          borderRadius={radius.lg.borderRadius}
        >
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
        </GradientCardBorder>
      </ScrollView>

      <CtaFadeBackground height={CTA_AREA_H}>
        <View style={[styles.ctaRowWrap, { left: H_PAD, right: H_PAD, bottom: 40 }]}>
          <GradientCtaButton
            variant="dual"
            width={ctaRowW}
            onPressLeft={() => navigation.navigate('Home')}
            onPressRight={() => navigation.navigate('Countdown')}
          />
        </View>
      </CtaFadeBackground>

      <BackButton onPress={() => navigation.navigate('Home')} />
      <TopSafeBlurOverlay safeTop={safeTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
    color: PALETTE.white,
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
    color: PALETTE.white,
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
    color: PALETTE.white,
    includeFontPadding: false,
  },
  statLabel: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    color: PALETTE.white,
    opacity: 0.5,
    includeFontPadding: false,
  },
  statValue: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: PALETTE.white,
    includeFontPadding: false,
  },
  ctaRowWrap: {
    position: 'absolute',
  },
});
