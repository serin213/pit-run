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

// ─── Circuit result PNG map (static requires for RN bundler) ──────────────────

const CIRCUIT_RESULT_PNG: Record<string, ImageSourcePropType> = {
  SHANGHAI:      require('../../assets/circuits/results/shanghai.png'),
  'LAS VEGAS':   require('../../assets/circuits/results/lasvegas.png'),
  SUZUKA:        require('../../assets/circuits/results/suzuka.png'),
  MONACO:        require('../../assets/circuits/results/monaco.png'),
  HUNGARY:       require('../../assets/circuits/results/hungary.png'),
  HUNGARORING:   require('../../assets/circuits/results/hungary.png'),
  'MARINA BAY':  require('../../assets/circuits/results/marinabay.png'),
  MONZA:         require('../../assets/circuits/results/monza.png'),
  BAKU:          require('../../assets/circuits/results/baku.png'),
  'ALBERT PARK': require('../../assets/circuits/results/albertpark.png'),
  SILVERSTONE:   require('../../assets/circuits/results/silverstone.png'),
  SPA:           require('../../assets/circuits/results/spa.png'),
};

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

// ─── Check-certificate icon (SVG, dynamic color) ─────────────────────────────

const CHECK_CERT_PATH =
  'M11.2361 1.39648C11.7264 1.20118 12.2731 1.20129 12.7634 1.39648C13.1642 1.5562 13.4578 1.82004 13.6794 2.07129C13.8894 2.30939 14.0816 2.59437 14.2205 2.78613C14.5458 3.23546 14.7119 3.35904 14.9304 3.375C15.1608 3.39157 15.4046 3.30534 15.8816 3.14355C16.2824 3.00763 16.8952 2.80399 17.5535 2.96777C18.0852 3.1003 18.5412 3.43903 18.8259 3.90625C19.0474 4.26995 19.1268 4.65234 19.158 4.98242C19.1874 5.29454 19.178 5.63768 19.1794 5.87109C19.1829 6.41711 19.2465 6.61753 19.4187 6.76172C19.5962 6.90996 19.8429 6.98452 20.3162 7.13477C20.7151 7.26142 21.3177 7.45723 21.7498 7.96582C22.1122 8.39284 22.2892 8.94795 22.2429 9.50586C22.208 9.92795 22.0484 10.282 21.8816 10.5664C21.7242 10.8346 21.5166 11.1066 21.3835 11.2949C21.0721 11.7356 21.0081 11.9354 21.0652 12.1553C21.1244 12.3829 21.2819 12.5897 21.574 12.9883C21.8213 13.3257 22.1883 13.8346 22.2429 14.4941L22.2498 14.7031C22.242 15.1889 22.0669 15.6606 21.7498 16.0342C21.4746 16.358 21.1371 16.5526 20.8347 16.6846C20.5495 16.809 20.222 16.9062 20.0037 16.9795C19.4919 17.1514 19.3266 17.2728 19.2458 17.4795C19.1593 17.7012 19.1665 17.9649 19.1707 18.4648C19.1742 18.888 19.1737 19.5225 18.8259 20.0938C18.5412 20.5609 18.0852 20.8997 17.5535 21.0322C17.1382 21.1355 16.7484 21.0941 16.4246 21.0215C16.1182 20.9528 15.7965 20.8355 15.575 20.7637C15.0549 20.5952 14.8526 20.5957 14.6697 20.7109C14.4694 20.8371 14.3206 21.055 14.0261 21.4717C13.7784 21.8222 13.3988 22.3492 12.7625 22.6025C12.2722 22.7977 11.7263 22.7989 11.2361 22.6035V22.6025C10.6003 22.349 10.2209 21.822 9.97339 21.4717C9.67886 21.0549 9.53024 20.8371 9.32983 20.7109C9.1531 20.5998 8.94776 20.5983 8.41968 20.7666C8.196 20.8379 7.87308 20.9526 7.56812 21.0205C7.2467 21.092 6.85795 21.1348 6.44604 21.0322C5.91437 20.8996 5.45818 20.5609 5.17358 20.0938C4.95221 19.7301 4.8727 19.3476 4.84155 19.0176C4.81212 18.7055 4.82156 18.3623 4.82007 18.1289C4.81657 17.5826 4.75319 17.3825 4.58081 17.2383C4.40333 17.0902 4.15665 17.0155 3.68335 16.8652C3.28438 16.7386 2.68166 16.5428 2.24976 16.0342C1.88739 15.6072 1.71053 15.0517 1.75659 14.4941C1.81121 13.8347 2.17824 13.3258 2.42554 12.9883C2.71756 12.5897 2.87505 12.383 2.93433 12.1553C2.98992 11.9415 2.92574 11.7396 2.61206 11.292C2.47882 11.1019 2.27234 10.8279 2.11597 10.5605C1.95071 10.2779 1.7913 9.92474 1.75659 9.50586C1.71052 8.94827 1.88744 8.39284 2.24976 7.96582C2.5248 7.64186 2.86242 7.4475 3.16479 7.31543C3.44996 7.19092 3.77738 7.09383 3.99585 7.02051C4.50774 6.84863 4.6728 6.72716 4.75366 6.52051L4.78198 6.43555C4.83873 6.22969 4.83249 5.97298 4.82886 5.53516C4.82535 5.11202 4.82591 4.47742 5.17358 3.90625C5.4582 3.43905 5.91441 3.10039 6.44604 2.96777C7.10428 2.80385 7.71703 3.0076 8.11792 3.14355C8.59493 3.30533 8.83882 3.39144 9.06909 3.375C9.28775 3.35918 9.45363 3.23558 9.77905 2.78613C9.91783 2.59444 10.1101 2.30942 10.3201 2.07129C10.5416 1.82007 10.8354 1.55626 11.2361 1.39648ZM16.5271 9.4668C16.2328 9.17601 15.7578 9.17861 15.4666 9.47266L11.03 13.9512L8.51538 11.5703C8.21453 11.2859 7.73945 11.2989 7.45483 11.5996C7.17043 11.9003 7.18369 12.3755 7.48413 12.6602L10.1765 15.209C10.6698 15.6758 11.4465 15.6631 11.9246 15.1807L16.533 10.5273C16.8241 10.233 16.8213 9.75816 16.5271 9.4668Z';

function CheckCertificateIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={CHECK_CERT_PATH} fill={color} />
    </Svg>
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
  trackPath, viewBox, themeColor, leftAlign }: SharePageProps & { leftAlign?: boolean }) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={[
      st.smallCard,
      leftAlign
        ? { alignItems: 'flex-start', paddingHorizontal: 20 }
        : null,
    ]} collapsable={false}>
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
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <CardCircuitSvg path={trackPath} viewBox={viewBox} color="#FFFFFF" size={52} strokePx={3} />
        </View>
      )}
    </View>
  );
}

// ─── Card 5 & 6: Fastest Lap sticker ─────────────────────────────────────────
// variant='default' → #8528c5 bg, white text, fastest-lap.png
// variant='purple'  → #AF3AFF 30% bg, #AF3AFF text, fastest-lap-purple.png

function FastestLapStickerCard({ fastestPaceS, variant = 'default' }: {
  fastestPaceS: number; variant?: 'default' | 'purple';
}) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  const isDefault  = variant === 'default';
  const pillBg     = isDefault ? '#8528c5' : '#AF3AFF4D';
  const textColor  = isDefault ? '#FFFFFF' : '#AF3AFF';
  const iconSource = isDefault
    ? require('../../assets/icons/fastest-lap.png')
    : require('../../assets/icons/fastest-lap-purple.png');
  return (
    <View ref={ref} style={st.fastestCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <View style={[st.fastestPill, { backgroundColor: pillBg }]}>
        <Image source={iconSource} style={{ width: undefined, height: 20, aspectRatio: 1 }} resizeMode="contain" />
        <View style={{ width: 6 }} />
        <Text style={[st.fastestLabelText, { color: textColor }]} numberOfLines={1}>
          FASTEST LAP
        </Text>
        <View style={{ width: 6 }} />
        <Text style={[st.fastestValueText, { color: textColor }]} numberOfLines={1}>
          {fmtPace(fastestPaceS)}
        </Text>
      </View>
    </View>
  );
}

// ─── Card 3 & 5: Circuit sticker (167×51) ────────────────────────────────────
// variant='solid'  → themeColor fill, white text   (3rd sticker)
// variant='ghost'  → themeColor 30% fill, theme text color (5th sticker)

function CircuitStickerCard({ circuitName, distKm, themeColor, themeTextColor,
  variant = 'solid' }: {
  circuitName: string; distKm: number; themeColor: string; themeTextColor: string;
  variant?: 'solid' | 'ghost';
}) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  const pillBg    = variant === 'solid' ? themeColor : themeColor + '4D';
  const textColor = variant === 'solid' ? '#FFFFFF' : themeTextColor;
  return (
    <View ref={ref} style={st.circuitStickerCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <View style={[st.circuitPill, { backgroundColor: pillBg }]}>
        <Text style={[st.circuitPillText, { color: textColor }]} numberOfLines={1}>
          {`${circuitName.toUpperCase()} GP ${fmtDist(distKm)}km`}
        </Text>
        <View style={{ width: 4 }} />
        <CheckCertificateIcon color={textColor} size={20} />
      </View>
    </View>
  );
}

// ─── Card 8: Wide medium stats ───────────────────────────────────────────────

function WideMediumCard({ distKm, elapsedMs, totalPaceS, fastestPaceS }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  return (
    <View ref={ref} style={st.wideMedCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <Text style={st.bigDist}>{fmtDist(distKm)}</Text>
      <View style={[st.medStatRow, { marginTop: 24 }]}>
        <View style={st.medStatCol}>
          <Text style={st.wideStatLabel}>TIME</Text>
          <Text style={st.wideStatValue}>{fmtTime(elapsedMs)}</Text>
        </View>
        <View style={st.medStatCol}>
          <Text style={st.wideStatLabel}>PACE AVG</Text>
          <Text style={st.wideStatValue}>{fmtPace(totalPaceS)}</Text>
        </View>
        <View style={st.medStatCol}>
          <Text style={st.wideStatLabel}>FASTEST</Text>
          <Text style={st.wideStatValue}>{fmtPace(fastestPaceS)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Card 9: Wide large stats + circuit PNG ──────────────────────────────────

function WideLargeCard({ distKm, elapsedMs, totalPaceS, fastestPaceS,
  circuitName }: SharePageProps) {
  const ref = useRef<View>(null);
  const share = useShareCard();
  const circuitPng = CIRCUIT_RESULT_PNG[circuitName.toUpperCase()];
  return (
    <View ref={ref} style={st.wideLargeCard} collapsable={false}>
      <ShareBtn onPress={() => share(ref)} />
      <Text style={st.bigDist}>{fmtDist(distKm)}</Text>

      {/* TIME — full width */}
      <View style={{ marginTop: 24 }}>
        <Text style={st.wideStatLabel}>TIME</Text>
        <Text style={st.wideStatValue}>{fmtTime(elapsedMs)}</Text>
      </View>

      {/* PACE AVG + FASTEST (left) / circuit PNG (right, top = PACE AVG value) */}
      <View style={{ flexDirection: 'row', marginTop: 20, alignItems: 'flex-start' }}>
        {/* Left: PACE AVG + FASTEST */}
        <View>
          <View>
            <Text style={st.wideStatLabel}>PACE AVG</Text>
            <Text style={st.wideStatValue}>{fmtPace(totalPaceS)}</Text>
          </View>
          <View style={{ marginTop: 20 }}>
            <Text style={st.wideStatLabel}>FASTEST</Text>
            <Text style={st.wideStatValue}>{fmtPace(fastestPaceS)}</Text>
          </View>
        </View>

        {/* Right: PNG — right-aligned, top = PACE AVG value */}
        {circuitPng && (
          <View style={st.largePngWrap}>
            <Image
              source={circuitPng}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%' }}
              resizeMode="contain"
            />
          </View>
        )}
      </View>
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
        <SmallPortraitCard {...props} leftAlign />
      </View>

      {/* Stickers 1열 — 3:solid 4:ghost 5:fastest 6:fastest */}
      <CircuitStickerCard circuitName={circuitName} distKm={props.distKm}
        themeColor={themeColor} themeTextColor={themeColor} variant="solid" />
      <CircuitStickerCard circuitName={circuitName} distKm={props.distKm}
        themeColor={themeColor} themeTextColor={themeColor} variant="ghost" />
      <FastestLapStickerCard fastestPaceS={fastestPaceS} variant="default" />
      <FastestLapStickerCard fastestPaceS={fastestPaceS} variant="purple" />

      {/* Card 8: Wide medium */}
      <WideMediumCard {...props} />

      {/* Card 9: Wide large */}
      <WideLargeCard {...props} />

      {/* Safe area */}
      <View style={{ height: 52 }} />
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
    justifyContent: 'center',
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
  circuitStickerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circuitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  circuitPillText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 20 * -0.02,
    color: '#FFFFFF',
    includeFontPadding: false,
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

  // Fastest Lap sticker
  fastestCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fastestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fastestLabelText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 20 * -0.02,
    includeFontPadding: false,
  },
  fastestValueText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 20 * -0.02,
    includeFontPadding: false,
  },

  // Wide medium
  wideMedCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    padding: 20,
    overflow: 'hidden',
  },
  medStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  medStatCol: {
    flex: 1,
  },

  // Wide large (height driven by content)
  wideLargeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    ...BORDER,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  largePngWrap: {
    flex: 1,
    height: 190,
    marginTop: 22,   // label(~14) + gap(8) → aligns with PACE AVG value text
    overflow: 'hidden',
  },

  // Shared wide card stat styles
  wideStatLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
  },
  wideStatValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 8,
    includeFontPadding: false,
  },

  // Shared
  bigDist: {
    fontFamily: 'Formula1-Black',
    fontSize: 85,
    color: '#FFFFFF',
    lineHeight: 85,
    includeFontPadding: false,
    letterSpacing: 85 * 0.05,
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
