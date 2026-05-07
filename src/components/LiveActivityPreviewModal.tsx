import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CIRCUITS } from '../config/circuits';
import { PALETTE } from '../constants/colors';
import CircuitMap from './CircuitMap';

// ─── Types ───────────────────────────────────────────────────────────────────

type PitPhase = 'none' | 'boxbox' | 'inPit' | 'fullPush';

interface PreviewState {
  label: string;
  pitPhase: PitPhase;
  paceS: number;
  distKm: number;
  prog: number;
  isPaused: boolean;
}

const AMBER = '#FCA311';
const TEAL = '#00D9C4';
const BG = '#111114';
const GRAY_LABEL = 'rgba(255,255,255,0.4)';

const PREVIEW_STATES: PreviewState[] = [
  { label: 'Dynamic Island — Compact',  pitPhase: 'none',     paceS: 330, distKm: 4.12, prog: 0.38, isPaused: false },
  { label: 'Dynamic Island — Expanded', pitPhase: 'none',     paceS: 330, distKm: 4.12, prog: 0.38, isPaused: false },
  { label: 'Lock Screen — Normal',      pitPhase: 'none',     paceS: 330, distKm: 4.12, prog: 0.38, isPaused: false },
  { label: 'Lock Screen — BOX BOX',     pitPhase: 'boxbox',   paceS: 0,   distKm: 4.12, prog: 0.38, isPaused: false },
  { label: 'Lock Screen — IN PIT',      pitPhase: 'inPit',    paceS: 0,   distKm: 4.12, prog: 0.38, isPaused: false },
];

function formatPace(s: number) {
  if (s <= 0) return '--\'--"';
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

// ─── DI Compact ──────────────────────────────────────────────────────────────

function DICompact({ state, width }: { state: PreviewState; width: number }) {
  const H = 44;
  return (
    <View style={[diS.pill, { width, height: H, borderRadius: H / 2 }]}>
      <Text style={diS.flagEmoji}>🏁</Text>
      <Text style={diS.compactDist}>{state.distKm.toFixed(2)}</Text>
    </View>
  );
}

// ─── DI Expanded ─────────────────────────────────────────────────────────────

function DIExpanded({ state, width }: { state: PreviewState; width: number }) {
  const H = 90;
  const BTN = 60;
  return (
    <View style={[diS.pill, { width, height: H, borderRadius: 28, paddingHorizontal: 16 }]}>
      {/* Buttons */}
      <View style={diS.btnRow}>
        <View style={[diS.ctaBtn, { width: BTN, height: BTN }]}>
          <Text style={diS.ctaIcon}>⏸</Text>
        </View>
        <View style={{ width: 10 }} />
        <View style={[diS.ctaBtn, { width: BTN, height: BTN }]}>
          <Text style={diS.ctaIcon}>⏹</Text>
        </View>
      </View>
      {/* Distance */}
      <View style={diS.expandedRight}>
        <Text style={diS.expandedDist}>{state.distKm.toFixed(2)}</Text>
        <Text style={diS.expandedKm}>km</Text>
      </View>
    </View>
  );
}

// ─── Bar Chart (BOX BOX) ──────────────────────────────────────────────────────

const BAR_HEIGHTS = [0.45, 0.65, 0.35, 0.80, 0.55, 0.90, 0.40, 0.70, 0.50, 0.85, 0.60, 0.75];

function BarChart({ width, height }: { width: number; height: number }) {
  const count = BAR_HEIGHTS.length;
  const gap = 6;
  const barW = (width - gap * (count + 1)) / count;
  const maxBarH = height * 0.7;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={TEAL} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={TEAL} stopOpacity="0.15" />
        </LinearGradient>
        <LinearGradient id="tealGlow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={TEAL} stopOpacity="0" />
          <Stop offset="100%" stopColor={TEAL} stopOpacity="0.25" />
        </LinearGradient>
      </Defs>
      {/* Bottom glow */}
      <Rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill="url(#tealGlow)" />
      {/* Bars */}
      {BAR_HEIGHTS.map((ratio, i) => {
        const bH = maxBarH * ratio;
        const x = gap + i * (barW + gap);
        const y = height - bH;
        return (
          <Rect key={i} x={x} y={y} width={barW} height={bH} rx={3} fill="url(#tealGrad)" />
        );
      })}
    </Svg>
  );
}

// ─── Lock Screen — Normal / IN PIT ───────────────────────────────────────────

function LockNormal({ state, circuit, width, height }: {
  state: PreviewState;
  circuit: typeof CIRCUITS[0];
  width: number;
  height: number;
}) {
  const inPit = state.pitPhase === 'inPit';
  const textColor = inPit ? PALETTE.white : AMBER;
  const mapColor = inPit ? 'rgba(255,255,255,0.25)' : AMBER;

  return (
    <View style={[ls.row, { width, height, paddingHorizontal: 16, paddingVertical: 14 }]}>
      {/* Left: circuit name + map */}
      <View style={ls.left}>
        <View style={ls.nameRow}>
          <Text style={ls.flagEmoji}>{circuit.countryFlag ?? '🏁'}</Text>
          <Text style={ls.circuitName}>{circuit.displayName?.toUpperCase()}</Text>
        </View>
        <View style={ls.mapWrap}>
          <CircuitMap
            progress={inPit ? 0 : state.prog}
            path={circuit.trackPath}
            startColor={mapColor}
            endColor={mapColor}
            viewBoxWidth={circuit.viewBox?.width}
            viewBoxHeight={circuit.viewBox?.height}
            startRect={circuit.startRect}
            checkerFlagCenter={circuit.checkerFlagCenter}
            startLenOverride={circuit.startLenOverride}
          />
        </View>
      </View>

      {/* Right: stats */}
      <View style={ls.right}>
        <Text style={ls.statLabel}>DISTANCE</Text>
        <Text style={[ls.statBig, { color: textColor }]}>{state.distKm.toFixed(2)}</Text>
        <Text style={ls.statLabel}>PACE</Text>
        <Text style={[ls.statBig, { color: textColor }]}>
          {inPit ? 'IN PIT' : formatPace(state.paceS)}
        </Text>
      </View>
    </View>
  );
}

// ─── Lock Screen — BOX BOX ───────────────────────────────────────────────────

function LockBoxBox({ width, height }: { width: number; height: number }) {
  return (
    <View style={[ls.boxboxRoot, { width, height }]}>
      <BarChart width={width} height={height} />
      <View style={ls.boxboxTextWrap}>
        <Text style={ls.boxboxText}>{'"BOX BOX'}</Text>
        <Text style={ls.boxboxText}>{'RECOVERY TIME"'}</Text>
      </View>
    </View>
  );
}

// ─── State Card ───────────────────────────────────────────────────────────────

function StateCard({ state, circuit, bannerW }: {
  state: PreviewState; circuit: typeof CIRCUITS[0]; bannerW: number;
}) {
  const isDICompact = state.label.includes('Compact');
  const isDIExpanded = state.label.includes('Expanded');
  const isBoxBox = state.pitPhase === 'boxbox';
  const LOCK_H = 170;

  return (
    <View style={card.wrap}>
      <Text style={card.label}>{state.label}</Text>
      {isDICompact ? (
        <DICompact state={state} width={bannerW * 0.55} />
      ) : isDIExpanded ? (
        <DIExpanded state={state} width={bannerW} />
      ) : isBoxBox ? (
        <View style={[card.banner, { width: bannerW, height: LOCK_H }]}>
          <LockBoxBox width={bannerW} height={LOCK_H} />
        </View>
      ) : (
        <View style={[card.banner, { width: bannerW, height: LOCK_H }]}>
          <LockNormal state={state} circuit={circuit} width={bannerW} height={LOCK_H} />
        </View>
      )}
    </View>
  );
}

// ─── Circuit Selector ────────────────────────────────────────────────────────

function CircuitSelector({ selected, onSelect }: {
  selected: string; onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sel.scroll} contentContainerStyle={sel.content}>
      {CIRCUITS.map(c => (
        <Pressable
          key={c.id}
          style={[sel.chip, selected === c.id && sel.chipActive]}
          onPress={() => onSelect(c.id)}
        >
          <Text style={[sel.chipText, selected === c.id && sel.chipTextActive]}>
            {c.displayName}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function LiveActivityPreviewModal({ visible, onClose }: {
  visible: boolean; onClose: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const HPAD = 20;
  const bannerW = winW - HPAD * 2;
  const [circuitId, setCircuitId] = useState('spa');
  const circuit = CIRCUITS.find(c => c.id === circuitId) ?? CIRCUITS[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.root}>
        <View style={modal.header}>
          <Text style={modal.title}>LIVE ACTIVITY PREVIEW</Text>
          <Pressable style={modal.closeBtn} onPress={onClose}>
            <Text style={modal.closeText}>✕</Text>
          </Pressable>
        </View>

        <CircuitSelector selected={circuitId} onSelect={setCircuitId} />

        <ScrollView contentContainerStyle={[modal.scroll, { paddingHorizontal: HPAD }]} showsVerticalScrollIndicator={false}>
          {PREVIEW_STATES.map(state => (
            <StateCard key={state.label} state={state} circuit={circuit} bannerW={bannerW} />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const diS = StyleSheet.create({
  pill: {
    backgroundColor: BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  flagEmoji: { fontSize: 22 },
  compactDist: {
    color: AMBER,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    letterSpacing: -0.5,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaBtn: {
    borderRadius: 30,
    backgroundColor: 'rgba(252,163,17,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIcon: { fontSize: 22 },
  expandedRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 4,
  },
  expandedDist: {
    color: AMBER,
    fontFamily: 'Formula1-Bold',
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 40,
  },
  expandedKm: {
    color: GRAY_LABEL,
    fontFamily: 'Formula1-Bold',
    fontSize: 16,
    lineHeight: 30,
    marginBottom: 4,
  },
});

const ls = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  left: {
    flex: 1.1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 14,
  },
  circuitName: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  mapWrap: {
    flex: 1,
  },
  right: {
    flex: 0.9,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 2,
    paddingLeft: 8,
  },
  statLabel: {
    color: GRAY_LABEL,
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  statBig: {
    fontFamily: 'Formula1-Bold',
    fontSize: 28,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  boxboxRoot: {
    overflow: 'hidden',
  },
  boxboxTextWrap: {
    position: 'absolute',
    top: 16,
    left: 18,
  },
  boxboxText: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    fontStyle: 'italic',
    lineHeight: 26,
  },
});

const card = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  banner: {
    borderRadius: 22,
    backgroundColor: BG,
    overflow: 'hidden',
  },
});

const sel = StyleSheet.create({
  scroll: { maxHeight: 40, marginBottom: 8 },
  content: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(252,163,17,0.15)',
    borderColor: AMBER,
  },
  chipText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
  },
  chipTextActive: { color: PALETTE.white },
});

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0E12' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: PALETTE.white, fontSize: 14 },
  scroll: { gap: 24, paddingTop: 8 },
});

