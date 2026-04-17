import React, { useMemo } from 'react';
import { BlurView } from 'expo-blur';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import GradientCtaButton from '../components/GradientCtaButton';
import GradientCardBorder from '../components/GradientCardBorder';
import { useAppStore } from '../store/appStore';
import { GRADE_DISPLAY_NAME } from '../constants/grade';
import { formatStopwatch, formatPace } from '../core/pace';
import { generateIntervalPlan, type IntervalSegment } from '../core/intervals';
import type { QualifyingPostScreenProps } from '../navigation/types';

const H_PAD = 20;

function segmentLabel(seg: IntervalSegment): string {
  if (seg.type === 'warmup') return 'Warm-up';
  if (seg.type === 'cooldown') return 'Cool-down';
  if (seg.type === 'recovery') return 'Recovery';
  // run
  if (seg.distanceM) return `Run ${seg.distanceM}m`;
  if (seg.durationSec) return `Run ${seg.durationSec}s`;
  return 'Run';
}

function segmentMeta(seg: IntervalSegment): string {
  if (seg.durationSec) {
    const min = Math.floor(seg.durationSec / 60);
    const sec = seg.durationSec % 60;
    if (min > 0 && sec > 0) return `${min}m ${sec}s`;
    if (min > 0) return `${min}min`;
    return `${sec}s`;
  }
  if (seg.targetPaceSecPerKm) return formatPace(seg.targetPaceSecPerKm);
  return '';
}

export default function QualifyingPostScreen({ navigation }: QualifyingPostScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const ctaW = windowW - H_PAD * 2;
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);

  const plan = useMemo(() => {
    if (!qualifyingResult) return null;
    return generateIntervalPlan(qualifyingResult.grade, qualifyingResult.paceSecPerKm);
  }, [qualifyingResult]);

  const gradeName = qualifyingResult
    ? GRADE_DISPLAY_NAME[qualifyingResult.grade]
    : 'Unranked';

  return (
    <View style={styles.root}>
      <BlurView intensity={60} tint="dark" style={[styles.topBlur, { height: safeTop }]} pointerEvents="none" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 80, paddingHorizontal: H_PAD, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} allowFontScaling={false}>
          License Earned
        </Text>

        {/* Grade + time card */}
        <GradientCardBorder style={styles.cardOuter} innerStyle={styles.cardInner}>
          <Text style={styles.gradeLabel}>GRADE</Text>
          <Text style={styles.gradeValue} allowFontScaling={false}>
            {gradeName}
          </Text>
          {qualifyingResult && (
            <>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>1km Time</Text>
                <Text style={styles.statValue}>{formatStopwatch(qualifyingResult.oneKmMs)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pace</Text>
                <Text style={styles.statValue}>{formatPace(qualifyingResult.paceSecPerKm)}/km</Text>
              </View>
            </>
          )}
        </GradientCardBorder>

        {/* Interval plan preview */}
        {plan && (
          <GradientCardBorder style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.planTitle}>YOUR INTERVAL PLAN</Text>
            <Text style={styles.planSubtitle}>
              {plan.totalSegments} segments based on your grade
            </Text>
            <View style={styles.segmentList}>
              {plan.segments.map((seg, i) => (
                <View key={i} style={styles.segmentRow}>
                  <View style={[styles.segmentDot, seg.type === 'run' ? styles.segmentDotRun : styles.segmentDotRest]} />
                  <Text style={styles.segmentLabel}>{segmentLabel(seg)}</Text>
                  <Text style={styles.segmentMeta}>{segmentMeta(seg)}</Text>
                </View>
              ))}
            </View>
          </GradientCardBorder>
        )}

        {qualifyingResult && (
          <Text style={styles.hint} allowFontScaling={false}>
            {qualifyingResult.nextIntervalHint}
          </Text>
        )}
      </ScrollView>

      <View style={[styles.ctaWrap, { paddingHorizontal: H_PAD, bottom: 40 }]}>
        <GradientCtaButton
          width={ctaW}
          height={58}
          label="CONTINUE"
          enabled
          onPress={() => navigation.replace('NextRace')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  topBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  scrollContent: {
    gap: 20,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 28,
    lineHeight: 34,
    color: '#FFFFFF',
    letterSpacing: 1.4,
    includeFontPadding: false,
    marginLeft: 4,
  },
  cardOuter: {
    borderRadius: 14,
  },
  cardInner: {
    padding: 20,
    gap: 12,
  },
  gradeLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
  },
  gradeValue: {
    fontFamily: 'Formula1-Black',
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
  },
  statValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 16,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  planTitle: {
    fontFamily: 'Formula1-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  planSubtitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
    marginBottom: 4,
  },
  segmentList: {
    gap: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentDotRun: {
    backgroundColor: '#E03A3E',
  },
  segmentDotRest: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentLabel: {
    flex: 1,
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    color: '#EAEAEA',
    includeFontPadding: false,
  },
  segmentMeta: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
  },
  hint: {
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.45)',
    includeFontPadding: false,
  },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
