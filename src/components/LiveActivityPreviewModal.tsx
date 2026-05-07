import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CIRCUITS } from '../config/circuits';
import { PALETTE } from '../constants/colors';
import CircuitMap from './CircuitMap';

type PitPhase = 'none' | 'boxbox' | 'inPit' | 'fullPush';
type Sector = 'yellow' | 'purple' | 'green';

interface PreviewState {
  label: string;
  pitPhase: PitPhase;
  sector: Sector;
  paceS: number;
  distKm: number;
  prog: number;
}

const AMBER = '#FCA311';
const BG = '#111114';
const GRAY_LABEL = 'rgba(255,255,255,0.4)';

const PREVIEW_STATES: PreviewState[] = [
  { label: 'Dynamic Island — Compact',  pitPhase: 'none',     sector: 'yellow', paceS: 330, distKm: 4.12, prog: 0.38 },
  { label: 'Dynamic Island — Expanded', pitPhase: 'none',     sector: 'yellow', paceS: 330, distKm: 4.12, prog: 0.38 },
  { label: 'Lock Screen — Normal',      pitPhase: 'none',     sector: 'yellow', paceS: 330, distKm: 4.12, prog: 0.38 },
  { label: 'Lock Screen — BOX BOX',     pitPhase: 'boxbox',   sector: 'yellow', paceS: 0,   distKm: 4.12, prog: 0.38 },
  { label: 'Lock Screen — IN PIT',      pitPhase: 'inPit',    sector: 'yellow', paceS: 0,   distKm: 4.12, prog: 0.38 },
  { label: 'Lock Screen — FULL PUSH',   pitPhase: 'fullPush', sector: 'green',  paceS: 342, distKm: 4.12, prog: 0.38 },
];

function sc(s: Sector): string {
  switch (s) {
    case 'purple': return '#9B59B6';
    case 'green':  return '#2ECC71';
    default:       return AMBER;
  }
}

function formatPace(s: number) {
  if (s <= 0) return '--\'--"';
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

// ─── DI Compact ──────────────────────────────────────────────────────────────

function DICompact({ state, width }: { state: PreviewState; width: number }) {
  const H = 44;
  return (
    <View style={[diS.pill, { width, height: H, borderRadius: H / 2 }]}>
      <Image source={require('../../assets/icon.png')} style={diS.appLogo} />
      <Text style={diS.compactDist}>{state.distKm.toFixed(2)}</Text>
    </View>
  );
}

// ─── DI Expanded ─────────────────────────────────────────────────────────────

function DIExpanded({ state, width }: { state: PreviewState; width: number }) {
  const H = 90;
  const color = sc(state.sector);
  return (
    <View style={[diS.pill, { width, height: H, borderRadius: 28, paddingHorizontal: 16 }]}>
      <View style={diS.btnRow}>
        <Image source={require('../../assets/control-buttons/pause-yellow.png')} style={diS.ctaBtn} />
        <View style={{ width: 12 }} />
        <Image source={require('../../assets/control-buttons/stop-yellow.png')} style={diS.ctaBtn} />
      </View>
      <View style={diS.expandedRight}>
        <Text style={[diS.expandedDist, { color }]}>{state.distKm.toFixed(2)}</Text>
        <Text style={[diS.expandedKm, { color }]}>km</Text>
      </View>
    </View>
  );
}

// ─── Wave (BOX BOX / FULL PUSH) ───────────────────────────────────────────────

const BAR_BASE = [28, 42, 34, 54, 46, 36, 46, 40, 32, 22, 34, 42, 50];
const WAVE_H = 58;
const WAVE_MAX_BAR_H = 54;
const WAVE_MIN_COL_W = 32;
const COL_OVERLAP = 0.2;

function WaveChart({ teamColor, width }: { teamColor: string; width: number }) {
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const colCount = Math.max(1, Math.floor(width / WAVE_MIN_COL_W));
  const colW = width / colCount;
  const fadeW = colW * 2;

  const seeds = useMemo(
    () => Array.from({ length: 64 }, (_, i) => { const v = Math.sin((i + 1) * 12.9898) * 43758.5453; return v - Math.floor(v); }),
    [],
  );

  const cols = useMemo(() => Array.from({ length: colCount }, (_, i) => {
    const base = BAR_BASE[i % BAR_BASE.length];
    const seed = seeds[i % seeds.length];
    const pace = 5.8 + seed * 2.1;
    const wave = 0.5 + 0.5 * Math.sin(t * pace + i * 0.56 + seed * Math.PI * 2);
    const harm = 0.5 + 0.5 * Math.sin(t * (pace * 0.5) + i * 0.2 + 1.2);
    const energy = 0.85 + 0.15 * Math.sin(t * 1.2);
    const h = Math.max(8, Math.min(WAVE_MAX_BAR_H, base * (0.5 + wave * 0.36 + harm * 0.14) * energy));
    return { x: i * colW, w: colW, h, y: WAVE_MAX_BAR_H - h };
  }), [colCount, colW, seeds, t]);

  useEffect(() => {
    const loop = (ts: number) => {
      if (!t0Ref.current) t0Ref.current = ts;
      setT((ts - t0Ref.current) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const r = parseInt(teamColor.slice(1, 3), 16);
  const g = parseInt(teamColor.slice(3, 5), 16);
  const b = parseInt(teamColor.slice(5, 7), 16);
  const solid = `rgba(${r},${g},${b},1)`;

  return (
    <Svg width={width} height={WAVE_H} viewBox={`0 0 ${width} ${WAVE_H}`} fill="none">
      <Defs>
        <LinearGradient id="waveCol" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={solid} stopOpacity={0} />
          <Stop offset="5%" stopColor={solid} stopOpacity={0} />
          <Stop offset="100%" stopColor={solid} stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id="fadeL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={fadeW} y2="0">
          <Stop offset="0%" stopColor="#17171C" stopOpacity={1} />
          <Stop offset="100%" stopColor="#17171C" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="fadeR" gradientUnits="userSpaceOnUse" x1={width} y1="0" x2={width - fadeW} y2="0">
          <Stop offset="0%" stopColor="#17171C" stopOpacity={1} />
          <Stop offset="100%" stopColor="#17171C" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {cols.map((c, i) => (
        <Rect key={i} x={Math.max(0, c.x - COL_OVERLAP / 2)} y={c.y} width={c.w + COL_OVERLAP} height={c.h} fill="url(#waveCol)" />
      ))}
      <Rect x={0} y={0} width={fadeW} height={WAVE_H} fill="url(#fadeL)" />
      <Rect x={width - fadeW} y={0} width={fadeW} height={WAVE_H} fill="url(#fadeR)" />
    </Svg>
  );
}

// ─── Lock Wave (BOX BOX / FULL PUSH) ─────────────────────────────────────────

function LockWave({ state, width, height }: { state: PreviewState; width: number; height: number }) {
  const color = sc(state.sector);
  const isBoxBox = state.pitPhase === 'boxbox';
  return (
    <View style={[lw.root, { width, height }]}>
      <Text style={[lw.text, { color }]}>{isBoxBox ? 'BOX BOX' : 'FULL PUSH'}</Text>
      {isBoxBox ? <Text style={[lw.text, { color }]}>{' RECOVERY TIME'}</Text> : null}
      <View style={{ height: 12 }} />
      <WaveChart teamColor={color} width={width - 36} />
    </View>
  );
}

// ─── Lock Normal / IN PIT ─────────────────────────────────────────────────────

function LockNormal({ state, circuit, width, height }: {
  state: PreviewState; circuit: typeof CIRCUITS[0]; width: number; height: number;
}) {
  const inPit = state.pitPhase === 'inPit';
  const color = inPit ? 'rgba(255,255,255,0.4)' : sc(state.sector);
  const trackColor = inPit ? 'rgba(255,255,255,0.25)' : sc(state.sector);

  return (
    <View style={[ln.row, { width, height, paddingHorizontal: 16, paddingVertical: 14 }]}>
      <View style={ln.left}>
        <View style={ln.nameRow}>
          {circuit.flagAsset ? <Image source={circuit.flagAsset} style={ln.flagImg} /> : null}
          <Text style={ln.circuitName}>{circuit.displayName?.toUpperCase()}</Text>
        </View>
        <View style={ln.mapWrap}>
          <CircuitMap
            progress={state.prog}
            path={circuit.trackPath}
            startColor={trackColor}
            endColor={trackColor}
            viewBoxWidth={circuit.viewBox?.width}
            viewBoxHeight={circuit.viewBox?.height}
            startRect={circuit.startRect}
            checkerFlagCenter={circuit.checkerFlagCenter}
            startLenOverride={circuit.startLenOverride}
            strokeWidth={4}
            dotColor={color}
          />
        </View>
      </View>
      <View style={ln.right}>
        <Text style={ln.statLabel}>DISTANCE</Text>
        <Text style={[ln.statValue, { color }]}>{state.distKm.toFixed(2)}</Text>
        <Text style={[ln.statLabel, { marginTop: 8 }]}>PACE</Text>
        {inPit
          ? <Text style={ln.inPitText}>IN PIT</Text>
          : <Text style={[ln.statValue, { color }]}>{formatPace(state.paceS)}</Text>
        }
      </View>
    </View>
  );
}

// ─── State Card ───────────────────────────────────────────────────────────────

function StateCard({ state, circuit, bannerW }: {
  state: PreviewState; circuit: typeof CIRCUITS[0]; bannerW: number;
}) {
  const isDICompact  = state.label.includes('Compact');
  const isDIExpanded = state.label.includes('Expanded');
  const isWave = state.pitPhase === 'boxbox' || state.pitPhase === 'fullPush';
  const LOCK_H = 160;

  return (
    <View style={card.wrap}>
      <Text style={card.label}>{state.label}</Text>
      {isDICompact ? (
        <DICompact state={state} width={bannerW * 0.6} />
      ) : isDIExpanded ? (
        <DIExpanded state={state} width={bannerW} />
      ) : isWave ? (
        <View style={[card.banner, { width: bannerW, height: LOCK_H }]}>
          <LockWave state={state} width={bannerW} height={LOCK_H} />
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

function CircuitSelector({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sel.scroll} contentContainerStyle={sel.content}>
      {CIRCUITS.map(c => (
        <Pressable key={c.id} style={[sel.chip, selected === c.id && sel.chipActive]} onPress={() => onSelect(c.id)}>
          <Text style={[sel.chipText, selected === c.id && sel.chipTextActive]}>{c.displayName}</Text>
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
      <View style={m.root}>
        <View style={m.header}>
          <Text style={m.title}>LIVE ACTIVITY PREVIEW</Text>
          <Pressable style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeText}>✕</Text>
          </Pressable>
        </View>
        <CircuitSelector selected={circuitId} onSelect={setCircuitId} />
        <ScrollView contentContainerStyle={[m.scroll, { paddingHorizontal: HPAD }]} showsVerticalScrollIndicator={false}>
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
  pill: { backgroundColor: BG, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  appLogo: { width: 28, height: 28, borderRadius: 6 },
  compactDist: { color: AMBER, fontFamily: 'Formula1-Regular', fontSize: 18, letterSpacing: -0.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  ctaBtn: { width: 52, height: 52 },
  expandedRight: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 2 },
  expandedDist: { fontFamily: 'Formula1-Bold', fontSize: 30, letterSpacing: -0.5, lineHeight: 34 },
  expandedKm: { fontFamily: 'Formula1-Regular', fontSize: 20, lineHeight: 26, marginBottom: 1 },
});

const lw = StyleSheet.create({
  root: { paddingHorizontal: 18, paddingTop: 16, overflow: 'hidden' },
  text: { fontFamily: 'Formula1-Italic', fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
});

const ln = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  left: { flex: 1.1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagImg: { width: 20, height: 13, borderRadius: 2 },
  circuitName: { color: PALETTE.white, fontFamily: 'Formula1-Bold', fontSize: 15 },
  mapWrap: { flex: 1 },
  right: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 12, gap: 2 },
  statLabel: { color: GRAY_LABEL, fontFamily: 'Formula1-Regular', fontSize: 13, letterSpacing: 0.3 },
  statValue: { fontFamily: 'Formula1-Bold', fontSize: 30, letterSpacing: -0.5, lineHeight: 34 },
  inPitText: { color: PALETTE.white, fontFamily: 'Formula1-Bold', fontSize: 28, letterSpacing: -0.5, lineHeight: 32 },
});

const card = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.35)', fontFamily: 'Formula1-Regular', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  banner: { borderRadius: 22, backgroundColor: BG, overflow: 'hidden' },
});

const sel = StyleSheet.create({
  scroll: { maxHeight: 40, marginBottom: 8 },
  content: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: 'rgba(252,163,17,0.15)', borderColor: AMBER },
  chipText: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Formula1-Regular', fontSize: 11 },
  chipTextActive: { color: PALETTE.white },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0E12' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { color: PALETTE.white, fontFamily: 'Formula1-Bold', fontSize: 13, letterSpacing: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: PALETTE.white, fontSize: 14 },
  scroll: { gap: 24, paddingTop: 8 },
});
