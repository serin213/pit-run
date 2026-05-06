import React, { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { CircuitDefinition } from '../config/circuits';
import { CARD_FILL } from './GradientCardBorder';
import { radius } from '../constants/radius';
import { PALETTE } from '../constants/colors';

export type CircuitTagType = 'Sprint' | 'Mixed' | 'Tempo';

type CircuitCardProps = {
  circuit: CircuitDefinition;
  tag: CircuitTagType;
  /** Figma 트랙 프레임 가로·세로 (해당 레이아웃 ref 너비 기준); 실제 위치는 우하단 inset 고정 */
  svgDisplayW: number;
  svgDisplayH: number;
  /** Full-width Best Match card (346×182 artboard); grid uses 167×182 */
  layout?: 'grid' | 'featured';
  /** Shown as ` · Nmin` after km when layout is featured; omitted in grid / when null */
  estimatedMinutes?: number | null;
  isSelected?: boolean;
  isDisabled?: boolean;
  isDimmed?: boolean;
  onPress?: () => void;
  cardWidth: number;
};

const GRID_FIGMA_W = 167;
const FEATURED_FIGMA_W = 346;
/** 세로는 디바이스와 무관하게 Figma와 동일 pt로 고정 */
const CARD_FIXED_HEIGHT = 182;
const CARD_RADIUS = radius.sm.borderRadius;
/** see all 그리드 카드: 트랙 우·하단 여백 (고정 pt, scale 없음) */
const TRACK_EDGE_INSET_GRID = 18;
/** Best Match 넓은 카드 */
const TRACK_EDGE_INSET_FEATURED = 24;

const TAG_CONFIG = {
  Sprint: { bg: 'rgba(224,58,62,0.3)', color: PALETTE.red },
  Mixed: { bg: 'rgba(252,184,39,0.3)', color: PALETTE.yellow },
  Tempo: { bg: 'rgba(89,179,69,0.3)', color: PALETTE.green },
} as const;

/** 카드 내부 텍스트·태그 패딩은 스케일 없이 고정 (Figma 167×182 / 346×182) */
const GRID_TEXT = {
  nameTop: 16,
  nameLeft: 16,
  distTop: 44,
  tagTop: 72,
  fontName: 20,
  lineName: 24,
  fontDist: 17,
  lineDist: 20,
  fontTag: 13,
  lineTag: 16,
  tagPadH: 6,
  tagPadV: 4,
  nameLetterSpacing: -0.4,
  tagLetterSpacing: -0.26,
} as const;

const FEATURED_TEXT = {
  nameTop: 20,
  nameLeft: 24,
  distTop: 57,
  tagTop: 89,
  fontName: 24,
  lineName: 29,
  fontDist: 17,
  lineDist: 20,
  fontTag: 17,
  lineTag: 20,
  tagPadH: 6,
  tagPadV: 4,
  nameLetterSpacing: -0.48,
  tagLetterSpacing: -0.34,
} as const;

export default function CircuitCard({
  circuit,
  tag,
  svgDisplayW,
  svgDisplayH,
  layout = 'grid',
  estimatedMinutes = null,
  isSelected = false,
  isDisabled = false,
  isDimmed = false,
  onPress,
  cardWidth,
}: CircuitCardProps) {
  const rawId = useId();
  const gradId = `circuitBorderGrad${rawId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const isFeatured = layout === 'featured';
  const refW = isFeatured ? FEATURED_FIGMA_W : GRID_FIGMA_W;
  const scaleX = cardWidth / refW;
  const cardHeight = CARD_FIXED_HEIGHT;

  const tagCfg = TAG_CONFIG[tag];
  const vbW = circuit.viewBox?.width ?? 286;
  const vbH = circuit.viewBox?.height ?? 185;

  const trackW = svgDisplayW * scaleX;
  const trackH = svgDisplayH * scaleX;

  const strokeW = 2 * (vbW / trackW);

  const tx = isFeatured ? FEATURED_TEXT : GRID_TEXT;
  const trackInset = isFeatured ? TRACK_EDGE_INSET_FEATURED : TRACK_EDGE_INSET_GRID;

  const kmPart = `${circuit.distanceKm.toFixed(1)}km`;
  const distanceLabel =
    isFeatured && estimatedMinutes != null ? `${kmPart} · ${estimatedMinutes}min` : kmPart;

  const outerOpacity = isDisabled || isDimmed ? 0.3 : 1;

  /** 카드 내부 콘텐츠 (선택 여부 무관하게 동일) */
  const content = (
    <>
      {/* 트랙은 먼저 그려 텍스트가 위에 오도록 */}
      <View
        style={[styles.trackWrap, { right: trackInset, bottom: trackInset, width: trackW, height: trackH }]}
        collapsable={false}
      >
        <Svg
          width={trackW}
          height={trackH}
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d={circuit.trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={strokeW}
            strokeMiterlimit={10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      <Text
        style={[
          styles.name,
          {
            top: tx.nameTop,
            left: tx.nameLeft,
            fontSize: tx.fontName,
            lineHeight: tx.lineName,
            letterSpacing: tx.nameLetterSpacing,
          },
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {circuit.displayName}
      </Text>

      <Text
        style={[
          styles.distance,
          {
            top: tx.distTop,
            left: tx.nameLeft,
            fontSize: tx.fontDist,
            lineHeight: tx.lineDist,
          },
        ]}
        allowFontScaling={false}
      >
        {distanceLabel}
      </Text>

      <View
        style={[
          styles.tag,
          {
            top: tx.tagTop,
            left: tx.nameLeft,
            backgroundColor: tagCfg.bg,
            paddingHorizontal: tx.tagPadH,
            paddingVertical: tx.tagPadV,
          },
        ]}
      >
        <Text
          style={[
            styles.tagText,
            {
              color: tagCfg.color,
              fontSize: tx.fontTag,
              lineHeight: tx.lineTag,
              letterSpacing: tx.tagLetterSpacing,
            },
          ]}
          allowFontScaling={false}
        >
          {tag}
        </Text>
      </View>
    </>
  );

  /* ── Selected: E03A3E 그라디언트 테두리 + 10% 배경 ── */
  if (isSelected) {
    return (
      <View style={{ width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS, opacity: outerOpacity }}>
        <Svg width={cardWidth} height={cardHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id={`${gradId}_sel`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardWidth} y2={cardHeight}>
              <Stop offset="0%" stopColor={PALETTE.red} stopOpacity="1" />
              <Stop offset="50%" stopColor={PALETTE.red} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={PALETTE.red} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0.25}
            y={0.25}
            width={cardWidth - 0.5}
            height={cardHeight - 0.5}
            rx={CARD_RADIUS - 0.25}
            ry={CARD_RADIUS - 0.25}
            fill="none"
            stroke={`url(#${gradId}_sel)`}
            strokeWidth={0.5}
          />
        </Svg>
        <Pressable
          onPress={isDisabled ? undefined : onPress}
          style={{ flex: 1, margin: 0.5, borderRadius: CARD_RADIUS - 0.5, backgroundColor: 'rgba(224,58,62,0.1)', overflow: 'hidden' }}
        >
          {content}
        </Pressable>
      </View>
    );
  }

  /* ── Default: 그라디언트 테두리 (SVG stroke-only — fill에 영향 없음) ── */
  return (
    <View style={{ width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS, opacity: outerOpacity }}>
      <Svg width={cardWidth} height={cardHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardWidth} y2={cardHeight}>
            <Stop offset="0%" stopColor={PALETTE.white} stopOpacity="0.18" />
            <Stop offset="25%" stopColor={PALETTE.white} stopOpacity="0.06" />
            <Stop offset="75%" stopColor={PALETTE.white} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={PALETTE.white} stopOpacity="0.12" />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x={0.25}
          y={0.25}
          width={cardWidth - 0.5}
          height={cardHeight - 0.5}
          rx={CARD_RADIUS - 0.25}
          ry={CARD_RADIUS - 0.25}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={0.5}
        />
      </Svg>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        style={{ flex: 1, margin: 0.5, borderRadius: CARD_RADIUS - 0.5, backgroundColor: CARD_FILL, overflow: 'hidden' }}
      >
        {content}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  trackWrap: {
    position: 'absolute',
  },
  name: {
    position: 'absolute',
    fontFamily: 'Formula1-Bold',
    color: PALETTE.white,
    includeFontPadding: false,
    zIndex: 1,
  },
  distance: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.34,
    includeFontPadding: false,
    zIndex: 1,
  },
  tag: {
    position: 'absolute',
    borderRadius: 2,
    zIndex: 1,
  },
  tagText: {
    fontFamily: 'Formula1-Regular',
    includeFontPadding: false,
  },
});
