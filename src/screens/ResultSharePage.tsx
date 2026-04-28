import React, { useRef, useCallback, RefObject } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { ImageSourcePropType } from 'react-native';
import { fmtTime, fmtPace, fmtDist } from '../utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharePageProps {
  distKm: number;
  elapsedMs: number;
  totalPaceS: number;
  fastestPaceS: number;
  circuitName: string;
  circuitKm: number;
  statusLabel: string;
  flagAsset?: ImageSourcePropType;
  trackPath?: string;
  viewBox?: { width: number; height: number };
  themeColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_BG   = '#202028';
const CARD_GAP  = 12;
const H_PAD     = 20;
const BORDER    = { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' } as const;

// ─── Share helper ─────────────────────────────────────────────────────────────

function useShareCard() {
  return useCallback(async (ref: RefObject<View | null>) => {
    try {
      const uri = await captureRef(ref as RefObject<View>, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (_) {}
  }, []);
}

// ─── Share icon button ────────────────────────────────────────────────────────

function ShareBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.shareBtn} hitSlop={10}>
      <Text style={st.shareBtnIcon}>⊙</Text>
    </Pressable>
  );
}

// ─── Circuit SVG (small, for cards) ──────────────────────────────────────────

function CardCircuitSvg({ path, viewBox, color, size, strokePx = 5 }: {
  path: string; viewBox: { width: number; height: number }; color: string; size: number; strokePx?: number;
}) {
  const scale  = size / viewBox.height;
  const w      = viewBox.width * scale;
  const h      = size;
  const strokeW = strokePx / scale;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}>
      <Path d={path} fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Card 1 & 2: Small portrait (167×286) ────────────────────────────────────

function SmallPortraitCard({ distKm, elapsedMs, totalPaceS, circuitName,
  trackPath, viewBox, themeColor }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={st.smallCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />

      {/* Circuit badge */}
      <View style={[st.smallBadge, { backgroundColor: themeColor }]}>
        <Text style={st.smallBadgeText} numberOfLines={1}>
          {circuitName.toUpperCase()} GP
        </Text>
      </View>

      {/* Distance */}
      <Text style={st.smallDist} numberOfLines={1}>
        {fmtDist(distKm)}km
      </Text>

      {/* TIME */}
      <Text style={[st.smallLabel, { marginTop: 16 }]}>TIME</Text>
      <Text style={[st.smallVal, { marginTop: 6 }]}>{fmtTime(elapsedMs)}</Text>

      {/* PACE AVG */}
      <Text style={[st.smallLabel, { marginTop: 20 }]}>PACE AVG</Text>
      <Text style={[st.smallVal, { marginTop: 6 }]}>{fmtPace(totalPaceS)}</Text>

      {/* Circuit SVG */}
      {trackPath && viewBox && (
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <CardCircuitSvg path={trackPath} viewBox={viewBox} color="#FFFFFF" size={52} strokePx={3} />
        </View>
      )}
    </View>
  );
}

// ─── Card 3 & 4: Sticker badge (167×51) ──────────────────────────────────────

function StickerCard({ label, sub, themeColor, purple }: {
  label: string; sub: string; themeColor: string; purple?: boolean;
}) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  const color = purple ? '#A855F7' : themeColor;
  return (
    <View ref={ref} style={st.stickerCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[st.stickerDot, { backgroundColor: color }]} />
        <Text style={st.stickerLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[st.stickerSub, { color }]} numberOfLines={1}>
          {' '}{sub}
        </Text>
      </View>
    </View>
  );
}

// ─── Card 5: Wide header bar (346×51) ────────────────────────────────────────

function WideHeaderCard({ circuitName, circuitKm, statusLabel, flagAsset, themeColor }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={st.wideHeaderCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {flagAsset && <Image source={flagAsset} style={{ width: 20, height: 14, marginRight: 8 }} resizeMode="contain" />}
        <Text style={st.wideHeaderTitle} numberOfLines={1}>
          {circuitName.toUpperCase()} ({circuitKm.toFixed(2)}km)
        </Text>
      </View>
      <Text style={[st.wideHeaderStatus, { color: themeColor }]}>{statusLabel}</Text>
    </View>
  );
}

// ─── Card 6: Wide medium stats (346×218) ─────────────────────────────────────

function WideMediumCard({ distKm, elapsedMs, totalPaceS, fastestPaceS }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={st.wideMedCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <Text style={st.bigDist}>{fmtDist(distKm)}</Text>
      <View style={st.medStatRow}>
        <View style={st.medStatCol}>
          <Text style={st.statLabel}>TIME</Text>
          <Text style={st.medStatValue}>{fmtTime(elapsedMs)}</Text>
        </View>
        <View style={st.medStatCol}>
          <Text style={st.statLabel}>PACE AVG</Text>
          <Text style={st.medStatValue}>{fmtPace(totalPaceS)}</Text>
        </View>
        <View style={st.medStatCol}>
          <Text style={st.statLabel}>FASTEST</Text>
          <Text style={st.medStatValue}>{fmtPace(fastestPaceS)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Card 7: Wide large stats + SVG (346×411) ────────────────────────────────

function WideLargeCard({ distKm, elapsedMs, totalPaceS, fastestPaceS,
  trackPath, viewBox, themeColor }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={st.wideLargeCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <Text style={st.bigDist}>{fmtDist(distKm)}</Text>

      <View style={{ marginTop: 24 }}>
        <Text style={st.statLabel}>TIME</Text>
        <Text style={st.largeStatValue}>{fmtTime(elapsedMs)}</Text>
      </View>
      <View style={{ marginTop: 20 }}>
        <Text style={st.statLabel}>PACE AVG</Text>
        <Text style={st.largeStatValue}>{fmtPace(totalPaceS)}</Text>
      </View>
      <View style={{ marginTop: 20 }}>
        <Text style={st.statLabel}>FASTEST</Text>
        <Text style={st.largeStatValue}>{fmtPace(fastestPaceS)}</Text>
      </View>

      {/* Circuit SVG bottom-right */}
      {trackPath && viewBox && (
        <View style={st.largeSvgWrap} pointerEvents="none">
          <CardCircuitSvg path={trackPath} viewBox={viewBox} color="rgba(255,255,255,0.5)" size={160} />
        </View>
      )}
    </View>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResultSharePage(props: SharePageProps) {
  const { circuitName, fastestPaceS, themeColor } = props;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={st.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={st.pageTitle}>Share to Instagram</Text>

      {/* Row 1: Two small portrait cards */}
      <View style={st.row}>
        <SmallPortraitCard {...props} />
        <SmallPortraitCard {...props} />
      </View>

      {/* Row 2 & 3: Sticker badges 2×2 */}
      <View style={st.row}>
        <StickerCard
          label={`${circuitName.toUpperCase()} GP  ${fmtDist(props.distKm)}km`}
          sub="✓" themeColor={themeColor} />
        <StickerCard
          label="Fastest Lap" sub={fmtPace(fastestPaceS)} themeColor={themeColor} purple />
      </View>
      <View style={st.row}>
        <StickerCard
          label={`${circuitName.toUpperCase()} GP  ${fmtDist(props.distKm)}km`}
          sub="✓" themeColor={themeColor} />
        <StickerCard
          label="Fastest Lap" sub={fmtPace(fastestPaceS)} themeColor={themeColor} purple />
      </View>

      {/* Row 4: Wide header */}
      <WideHeaderCard {...props} />

      {/* Row 5: Wide medium */}
      <WideMediumCard {...props} />

      {/* Row 6: Wide large */}
      <WideLargeCard {...props} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    paddingBottom: 120,
    gap: CARD_GAP,
  },
  pageTitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },

  // Share button
  shareBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  shareBtnIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },

  // Small portrait 167×286
  smallCard: {
    flex: 1,
    height: 286,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingVertical: 16,
    paddingHorizontal: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  smallBadge: {
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  smallBadgeText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  smallDist: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    lineHeight: 22,
    color: '#FFFFFF',
    includeFontPadding: false,
    marginTop: 12,
  },
  smallLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.2,
  },
  smallVal: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    lineHeight: 22,
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  // Sticker 167×51
  stickerCard: {
    flex: 1,
    height: 51,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stickerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  stickerLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  stickerSub: {
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
  },

  // Wide header 346×51
  wideHeaderCard: {
    height: 51,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wideHeaderTitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    color: '#FFFFFF',
    flex: 1,
  },
  wideHeaderStatus: {
    fontFamily: 'Formula1-Bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // Wide medium 346×218
  wideMedCard: {
    height: 218,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  medStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  medStatCol: {
    flex: 1,
  },
  medStatValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 4,
    includeFontPadding: false,
  },

  // Wide large 346×411
  wideLargeCard: {
    height: 411,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    padding: 20,
    overflow: 'hidden',
  },
  largeSvgWrap: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    opacity: 0.7,
  },
  largeStatValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 4,
    includeFontPadding: false,
  },

  // Shared
  bigDist: {
    fontFamily: 'Formula1-Black',
    fontSize: 80,
    color: '#FFFFFF',
    lineHeight: 84,
    includeFontPadding: false,
    letterSpacing: -2,
  },
  statLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
  },
  statValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 3,
    includeFontPadding: false,
  },
});
