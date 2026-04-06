import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import GradientCtaButton from '../components/GradientCtaButton';
import CircuitCard from '../components/CircuitCard';
import TireIcon from '../components/TireIcon';
import BackButton from '../components/BackButton';
import type { CircuitTagType } from '../components/CircuitCard';
import { CIRCUITS } from '../config/circuits';
import type { CircuitCardConfig } from '../config/circuitCardConfig';
import { CIRCUIT_CARD_CONFIG } from '../config/circuitCardConfig';
import { useAppStore } from '../store/appStore';
import type { TireType } from '../constants/colors';
import type { SetupScreenProps } from '../navigation/types';

const H_PAD = 28;
const CARD_GAP = 12;

// 4 tire rows, each 59pt tall. New icons are 44×41 — all rows use equal height.
const TIRE_ROW_H = 59;
const TIRE_EXPANDED_H = 4 * TIRE_ROW_H; // 236 — all 4 rows fully visible
const TIRE_COLLAPSED_H = TIRE_ROW_H;    // 59 — full selected row visible

// Gap between title bottom and tire section (from Figma: y:169 - (y:74 + h:43) = 52)
const TITLE_TO_TIRE_GAP = 52;
// Gap between tire section and circuit section (from Figma: y:256 - y:204 = 52)
const TIRE_TO_CIRCUIT_GAP = 52;

const CTA_CONTAINER_H = 164; // fade + START (treadmill row spec’d out for v1)

const TIRES: Array<{
  type: TireType;
  letter: string;
  color: string;
  description: string;
}> = [
  { type: 'soft', letter: 'S', color: '#E03A3E', description: 'Short run, Long rest' },
  { type: 'medium', letter: 'M', color: '#FCB827', description: 'Balanced' },
  { type: 'hard', letter: 'H', color: '#F8F8F9', description: 'Long run, Short rest' },
  { type: 'wet', letter: 'W', color: '#4CB5C9', description: 'Easy and Gentle' },
];

/** Featured 카드용 트랙 박스 크기 (346 기준); 위치는 CircuitCard에서 우하단 inset 고정 */
function featuredTrackSize(cfg: CircuitCardConfig) {
  const f = cfg.featured;
  const r = 346 / 167;
  return {
    w: f?.svgW ?? cfg.svgW * r,
    h: f?.svgH ?? cfg.svgH * r,
  };
}

export default function SetupScreen({ navigation }: SetupScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();
  const {
    setSelectedCircuitId: storeSetCircuit,
    setSelectedTire: storeSetTire,
    selectedCircuitId: storeCircuitId,
    qualifyingResult,
    paceRecords,
  } = useAppStore();

  const CARD_W = (windowW - H_PAD * 2 - CARD_GAP) / 2;
  const BEST_MATCH_CARD_W = windowW - H_PAD * 2;

  const [selectedTire, setSelectedTire] = useState<TireType | null>(null);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);
  const [tireExpanded, setTireExpanded] = useState(false);
  const tireSectionH = useRef(new Animated.Value(TIRE_EXPANDED_H)).current;
  // Translates the entire tire list so the selected tire slides to position 0
  const tiresTranslateY = useRef(new Animated.Value(0)).current;
  const circuitOpacity = useRef(new Animated.Value(0)).current;
  const circuitTranslateY = useRef(new Animated.Value(16)).current;
  // Dissolve animation for circuit grid deselection
  const circuitGridOpacity = useRef(new Animated.Value(1)).current;

  // Track previous storeCircuitId to detect when AllCircuits made a change
  const prevStoreCircuitIdRef = useRef(storeCircuitId);

  // Track the last circuit selected from "see all" — always placed in slot 0.
  const [lastSeeAllCircuitId, setLastSeeAllCircuitId] = useState<string | null>(null);

  const paceSecPerKm = useMemo(() => {
    const q = qualifyingResult?.paceSecPerKm;
    if (typeof q === 'number' && q > 0) return q;
    const best = paceRecords.bestEver;
    if (Number.isFinite(best) && best > 0 && best < Number.POSITIVE_INFINITY) return best;
    return null;
  }, [qualifyingResult, paceRecords.bestEver]);

  const estimatedMinutesForCircuit = useCallback(
    (distanceKm: number) => {
      if (paceSecPerKm == null) return null;
      const totalS = Math.round(paceSecPerKm * distanceKm);
      return Math.max(1, Math.round(totalS / 60));
    },
    [paceSecPerKm],
  );

  // Best Match: two picks (design default Monaco + Albert Park when available)
  const baseCircuits = useMemo(() => {
    const monaco = CIRCUITS.find((c) => c.id === 'monaco');
    const albert = CIRCUITS.find((c) => c.id === 'albert-park');
    if (monaco && albert) return [monaco, albert];
    const shuffled = [...CIRCUITS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }, []);

  // Sync circuit selection when returning from AllCircuits.
  // Any circuit returned from AllCircuitsScreen is treated as a "see-all" selection
  // and placed in slot 0, regardless of whether it's also in baseCircuits.
  // NOTE: selectedCircuitId is intentionally NOT in deps.
  useFocusEffect(
    useCallback(() => {
      if (prevStoreCircuitIdRef.current !== storeCircuitId && storeCircuitId) {
        setSelectedCircuitId(storeCircuitId);
        setLastSeeAllCircuitId(storeCircuitId); // always slot 0 for see-all selections
      }
      prevStoreCircuitIdRef.current = storeCircuitId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeCircuitId]),
  );

  // Best Match column: see-all circuit takes slot 0.
  // If it's also a Best Match circuit, rearrange the 2 cards (no duplication).
  // If it's not in Best Match, replace slot 0 only (slot 1 = baseCircuits[1]).
  const isSeeAllInBase = lastSeeAllCircuitId !== null && baseCircuits.some((c) => c.id === lastSeeAllCircuitId);

  const displayedCircuits = useMemo(() => {
    if (!lastSeeAllCircuitId) return baseCircuits;
    const seeAllCircuit = CIRCUITS.find((c) => c.id === lastSeeAllCircuitId);
    if (!seeAllCircuit) return baseCircuits;
    const inBase = baseCircuits.some((c) => c.id === lastSeeAllCircuitId);
    if (inBase) {
      // Rearrange Best Match: selected circuit first, remaining in original order
      return [seeAllCircuit, ...baseCircuits.filter((c) => c.id !== lastSeeAllCircuitId)];
    }
    const second = baseCircuits[1] ?? baseCircuits[0];
    return [seeAllCircuit, second];
  }, [lastSeeAllCircuitId, baseCircuits]);

  // Dissolve 슬롯은 `circuitGridOpacity`를 공유하는데, 레이아웃이 바뀌며 언마운트될 때 값이 0이면
  // 다음에 see all로 베이스 밖 서킷을 고르면 전경 카드가 계속 투명하게 남는다.
  useEffect(() => {
    if (lastSeeAllCircuitId && !isSeeAllInBase) {
      circuitGridOpacity.setValue(1);
    }
  }, [lastSeeAllCircuitId, isSeeAllInBase, circuitGridOpacity]);

  const circuitSectionLabel = (lastSeeAllCircuitId !== null && !isSeeAllInBase) ? 'Circuits' : 'Best Match';

  // Deselection:
  // - Best Match rearrangement (see-all + in base): instant state reset, no dissolve.
  // - True see-all (not in base): cross-dissolve (foreground fades out revealing background,
  //   then fades back in with Best Match state after state updates propagate).
  const handleCircuitPress = useCallback(
    (circuitId: string) => {
      const isCurrentlySelected = circuitId === selectedCircuitId;
      if (isCurrentlySelected) {
        const isBaseRearrangement = lastSeeAllCircuitId !== null && baseCircuits.some((c) => c.id === circuitId);
        if (isBaseRearrangement) {
          // Just reset to original Best Match order — no dissolve needed
          setSelectedCircuitId(null);
          setLastSeeAllCircuitId(null);
          circuitGridOpacity.setValue(1);
          (storeSetCircuit as (id: string | null) => void)(null);
        } else {
          Animated.timing(circuitGridOpacity, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              setSelectedCircuitId(null);
              setLastSeeAllCircuitId(null);
              (storeSetCircuit as (id: string | null) => void)(null);
              circuitGridOpacity.setValue(1);
            }
          });
        }
      } else {
        // Local card tap (slots 1-3 or Best Match grid): clear see-all pin
        setSelectedCircuitId(circuitId);
        setLastSeeAllCircuitId(null);
      }
    },
    [selectedCircuitId, lastSeeAllCircuitId, baseCircuits, circuitGridOpacity, storeSetCircuit],
  );

  const handleTirePress = useCallback(
    (tire: TireType) => {
      const isFirstSelection = selectedTire === null;

      // Tap same collapsed tire → expand (same as chevron press)
      if (!isFirstSelection && !tireExpanded && tire === selectedTire) {
        setTireExpanded(true);
        Animated.parallel([
          Animated.timing(tireSectionH, {
            toValue: TIRE_EXPANDED_H,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(tiresTranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
        return;
      }

      const tireIdx = TIRES.findIndex((t) => t.type === tire);
      const targetTranslateY = -(tireIdx * TIRE_ROW_H);

      setSelectedTire(tire);

      // Both first-selection and re-selection use identical collapse animation.
      // First selection additionally reveals the circuit section.
      Animated.parallel([
        Animated.timing(tireSectionH, {
          toValue: TIRE_COLLAPSED_H,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(tiresTranslateY, {
          toValue: targetTranslateY,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        ...(isFirstSelection
          ? [
              Animated.sequence([
                Animated.delay(120),
                Animated.parallel([
                  Animated.timing(circuitOpacity, {
                    toValue: 1,
                    duration: 260,
                    useNativeDriver: true,
                  }),
                  Animated.timing(circuitTranslateY, {
                    toValue: 0,
                    duration: 260,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                ]),
              ]),
            ]
          : []),
      ]).start(({ finished }) => {
        if (finished) setTireExpanded(false);
      });
    },
    [selectedTire, tireExpanded, tireSectionH, tiresTranslateY, circuitOpacity, circuitTranslateY],
  );

  const handleChevronPress = useCallback(() => {
    if (!tireExpanded) {
      // Expand: slide tires back to original positions
      setTireExpanded(true);
      Animated.parallel([
        Animated.timing(tireSectionH, {
          toValue: TIRE_EXPANDED_H,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(tiresTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Collapse via chevron: slide selected tire to position 0
      const selectedIdx = TIRES.findIndex((t) => t.type === selectedTire);
      Animated.parallel([
        Animated.timing(tireSectionH, {
          toValue: TIRE_COLLAPSED_H,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(tiresTranslateY, {
          toValue: -(selectedIdx * TIRE_ROW_H),
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setTireExpanded(false);
      });
    }
  }, [tireExpanded, tireSectionH, tiresTranslateY, selectedTire]);

  const canStart = selectedTire !== null && selectedCircuitId !== null;

  // BackButton: top=safeTop+14, height≈25 → bottom=safeTop+39 → title 24pt below = safeTop+63
  // ScrollView starts at safeTop (after spacer), so paddingTop=63 places title at safeTop+63
  const titleTopPadding = 63;

  return (
    <View style={styles.root}>
      {/* Status bar blocker — height matches SafeAreaOverlay's statusH */}
      <View style={{ height: safeTop, backgroundColor: '#17171C' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: titleTopPadding, paddingBottom: CTA_CONTAINER_H },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title} allowFontScaling={false}>
          {selectedTire ? 'Pick Circuit' : 'Pick Tyre'}
        </Text>

        {/* Tire section */}
        <Animated.View
          style={[styles.tireSection, { height: tireSectionH }]}
        >
          {/* Inner view slides all tires up so selected tire reaches position 0 */}
          <Animated.View style={{ transform: [{ translateY: tiresTranslateY }] }}>
            {TIRES.map((tire) => {
              const isActive = selectedTire === tire.type;
              // Collapsed: chevron on selected tire. Expanded: chevron on first tire (S).
              const showChevron = selectedTire !== null && (
                tireExpanded ? TIRES[0].type === tire.type : isActive
              );
              return (
                <Pressable
                  key={tire.type}
                  onPress={() => handleTirePress(tire.type)}
                  style={[styles.tireRow, !isActive && tireExpanded && styles.tireRowDimmed]}
                >
                  {/* Tire icon */}
                  <TireIcon type={tire.type} />

                  {/* Description */}
                  <Text style={styles.tireDescription} allowFontScaling={false}>
                    {tire.description}
                  </Text>

                  {showChevron && (
                    <Pressable
                      onPress={handleChevronPress}
                      style={styles.chevronBtn}
                      hitSlop={12}
                    >
                      <Svg width={16} height={9} viewBox="0 0 16 9">
                        <Path
                          d={tireExpanded ? 'M1 8L8 2L15 8' : 'M1 1L8 7L15 1'}
                          stroke="rgba(255,255,255,0.7)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </Svg>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </Animated.View>

        {/* Circuit section — hidden until tire is selected */}
        {selectedTire !== null && (
          <Animated.View
            style={[
              styles.circuitSection,
              {
                opacity: circuitOpacity,
                transform: [{ translateY: circuitTranslateY }],
              },
            ]}
          >
            {/* Header row: single layer, updates instantly (not part of dissolve) */}
            <View style={styles.bestMatchRow}>
              <Text style={styles.bestMatchLabel} allowFontScaling={false}>
                {circuitSectionLabel}
              </Text>
              <Pressable style={styles.seeAllBtn} onPress={() => navigation.navigate('AllCircuits', { currentCircuitId: selectedCircuitId })}>
                <Text style={styles.seeAllText} allowFontScaling={false}>see all</Text>
                <Svg width={6} height={10} viewBox="0 0 6 10">
                  <Path d="M1 1L5 5L1 9" stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </Pressable>
            </View>

            {/* Best Match: two full-width cards; slot 0 may use cross-dissolve */}
            <View style={styles.bestMatchCardColumn}>
              {displayedCircuits.map((circuit, index) => {
                const cfg = CIRCUIT_CARD_CONFIG[circuit.id] ?? {
                  tag: 'Mixed' as CircuitTagType,
                  svgX: 65, svgY: 115, svgW: 80, svgH: 50,
                };
                const feat = featuredTrackSize(cfg);
                const eta = estimatedMinutesForCircuit(circuit.distanceKm);
                const isSelected = circuit.id === selectedCircuitId;
                const isDimmed = selectedCircuitId !== null && !isSelected;

                if (index === 0 && lastSeeAllCircuitId !== null && !isSeeAllInBase) {
                  const bgCircuit = baseCircuits[0];
                  const bgCfg = CIRCUIT_CARD_CONFIG[bgCircuit.id] ?? {
                    tag: 'Mixed' as CircuitTagType,
                    svgX: 65, svgY: 115, svgW: 80, svgH: 50,
                  };
                  const bgFeat = featuredTrackSize(bgCfg);
                  const bgEta = estimatedMinutesForCircuit(bgCircuit.distanceKm);
                  return (
                    <View key={`slot0-${circuit.id}`} style={{ width: BEST_MATCH_CARD_W }}>
                      <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <CircuitCard
                          layout="featured"
                          circuit={bgCircuit}
                          tag={bgCfg.tag}
                          svgDisplayW={bgFeat.w}
                          svgDisplayH={bgFeat.h}
                          estimatedMinutes={bgEta}
                          isSelected={false}
                          isDimmed={false}
                          onPress={() => {}}
                          cardWidth={BEST_MATCH_CARD_W}
                        />
                      </View>
                      <Animated.View style={{ opacity: circuitGridOpacity }} collapsable={false}>
                        <CircuitCard
                          layout="featured"
                          circuit={circuit}
                          tag={cfg.tag}
                          svgDisplayW={feat.w}
                          svgDisplayH={feat.h}
                          estimatedMinutes={eta}
                          isSelected={isSelected}
                          isDimmed={isDimmed}
                          onPress={() => handleCircuitPress(circuit.id)}
                          cardWidth={BEST_MATCH_CARD_W}
                        />
                      </Animated.View>
                    </View>
                  );
                }

                return (
                  <CircuitCard
                    key={circuit.id}
                    layout="featured"
                    circuit={circuit}
                    tag={cfg.tag}
                    svgDisplayW={feat.w}
                    svgDisplayH={feat.h}
                    estimatedMinutes={eta}
                    isSelected={isSelected}
                    isDimmed={isDimmed}
                    onPress={() => handleCircuitPress(circuit.id)}
                    cardWidth={BEST_MATCH_CARD_W}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom CTA — shown after tire selection */}
      {selectedTire !== null && (
        <View style={[styles.ctaContainer, { height: CTA_CONTAINER_H }]} pointerEvents="box-none">
          <Svg
            width={windowW}
            height={CTA_CONTAINER_H}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="setupFade" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
                <Stop offset="66%" stopColor="#17171C" stopOpacity="1" />
                <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={windowW} height={CTA_CONTAINER_H} fill="url(#setupFade)" />
          </Svg>
          <View style={[styles.ctaBtnWrap, { bottom: 40 }]}>
            <GradientCtaButton
              width={windowW - H_PAD * 2}
              label="START"
              enabled={canStart}
              onPress={() => {
                if (canStart) {
                  storeSetTire(selectedTire!);
                  storeSetCircuit(selectedCircuitId!);
                  navigation.navigate('Countdown');
                }
              }}
              textButtonType="none"
            />
          </View>
        </View>
      )}
      {/* BackButton rendered last so it appears above scroll content and CTA */}
      <BackButton onPress={() => navigation.goBack()} />
      {/* Safe-area blockers: inside the native screen view → reliably cover scroll content */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop + 63, backgroundColor: '#17171C', zIndex: 1000 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: safeBottom, backgroundColor: '#17171C', zIndex: 1000 }} />
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
    paddingHorizontal: H_PAD,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    color: '#FFFFFF',
    letterSpacing: 1.8,
    includeFontPadding: false,
    marginBottom: TITLE_TO_TIRE_GAP,
  },
  tireSection: {
    overflow: 'hidden',
    marginBottom: TIRE_TO_CIRCUIT_GAP,
  },
  tireRow: {
    height: TIRE_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tireRowDimmed: {
    opacity: 0.35,
  },
  tireDescription: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.4,
    includeFontPadding: false,
    flex: 1,
  },
  chevronBtn: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circuitSection: {
    // opacity & translateY animated
  },
  bestMatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  bestMatchLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20.4,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.34,
    includeFontPadding: false,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seeAllText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 22.1,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.34,
    includeFontPadding: false,
  },
  bestMatchCardColumn: {
    width: '100%',
    gap: CARD_GAP,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  ctaBtnWrap: {
    position: 'absolute',
    left: H_PAD,
    right: H_PAD,
  },
});
