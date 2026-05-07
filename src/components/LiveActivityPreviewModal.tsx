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
import Svg, { Path } from 'react-native-svg';
import { CIRCUITS } from '../config/circuits';
import { PALETTE } from '../constants/colors';
import CircuitMap from './CircuitMap';

// ─── Types ───────────────────────────────────────────────────────────────────

type PitPhase = 'none' | 'boxbox' | 'inPit' | 'fullPush';
type Sector = 'yellow' | 'purple' | 'green';
type Tire = 'soft' | 'medium' | 'hard' | 'wet';

interface PreviewState {
  label: string;
  pitPhase: PitPhase;
  sector: Sector;
  tire: Tire;
  paceS: number;
  distKm: number;
  elapsedMs: number;
  prog: number;
  isPaused: boolean;
}

const TEAM_COLOR = '#E8002D'; // Ferrari red for preview

const PREVIEW_STATES: PreviewState[] = [
  { label: 'Normal — Green', pitPhase: 'none',     sector: 'green',  tire: 'soft',   paceS: 315, distKm: 3.47, elapsedMs: 1_095_000, prog: 0.68, isPaused: false },
  { label: 'Normal — Purple', pitPhase: 'none',    sector: 'purple', tire: 'medium', paceS: 336, distKm: 2.14, elapsedMs: 720_000,   prog: 0.42, isPaused: false },
  { label: 'Paused',           pitPhase: 'none',   sector: 'purple', tire: 'medium', paceS: 336, distKm: 2.14, elapsedMs: 720_000,   prog: 0.42, isPaused: true  },
  { label: 'BOX BOX',          pitPhase: 'boxbox', sector: 'yellow', tire: 'medium', paceS: 0,   distKm: 2.14, elapsedMs: 720_000,   prog: 0.42, isPaused: false },
  { label: 'IN PIT',           pitPhase: 'inPit',  sector: 'yellow', tire: 'medium', paceS: 0,   distKm: 2.14, elapsedMs: 720_000,   prog: 0.42, isPaused: false },
  { label: 'FULL PUSH',        pitPhase: 'fullPush', sector: 'green', tire: 'hard',  paceS: 342, distKm: 2.14, elapsedMs: 720_000,   prog: 0.42, isPaused: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPace(s: number) {
  if (s <= 0) return "--'--\"";
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function sectorColor(sector: Sector) {
  switch (sector) {
    case 'purple': return '#9B59B6';
    case 'green':  return '#2ECC71';
    default:       return '#F1C40F';
  }
}

function tireLabel(tire: Tire) {
  switch (tire) { case 'medium': return 'M'; case 'hard': return 'H'; case 'wet': return 'W'; default: return 'S'; }
}

function tireColor(tire: Tire) {
  switch (tire) {
    case 'medium': return '#F5C518';
    case 'hard':   return '#FFFFFF';
    case 'wet':    return '#4CB5C9';
    default:       return '#E8002D';
  }
}

// ─── Wave Background ─────────────────────────────────────────────────────────

function WaveBackground({ color, width, height }: { color: string; width: number; height: number }) {
  const waves = 3.5;
  const amp = height * 0.25;
  const mid = height * 0.5;
  const pts: string[] = [];
  for (let x = 0; x <= width; x += 4) {
    const y = mid - amp * Math.sin((x / width) * waves * 2 * Math.PI);
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const wavePath = `M ${pts.join(' L ')}`;
  const fillPath = `${wavePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Path d={fillPath} fill={color} fillOpacity={0.1} />
      <Path d={wavePath} stroke={color} strokeOpacity={0.75} strokeWidth={2} fill="none" />
    </Svg>
  );
}

// ─── Stats Panel ─────────────────────────────────────────────────────────────

function StatsPanel({ state }: { state: PreviewState }) {
  return (
    <View style={s.statsPanel}>
      <View style={s.distRow}>
        <Text style={s.distNum}>{state.distKm.toFixed(2)}</Text>
        <Text style={s.distKm}> km</Text>
      </View>

      {state.pitPhase === 'inPit' ? (
        <Text style={s.inPitLabel}>IN PIT</Text>
      ) : (
        <View style={s.paceRow}>
          <View style={[s.sectorDot, { backgroundColor: sectorColor(state.sector) }]} />
          <Text style={s.paceText}>{formatPace(state.paceS)}</Text>
        </View>
      )}

      <View style={s.bottomRow}>
        <Text style={s.elapsedText}>{formatElapsed(state.elapsedMs)}</Text>
        <View style={s.tireBadge}>
          <Text style={[s.tireText, { color: tireColor(state.tire) }]}>
            {tireLabel(state.tire)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Normal Banner ────────────────────────────────────────────────────────────

function NormalBanner({ state, circuit, bannerW }: { state: PreviewState; circuit: typeof CIRCUITS[0]; bannerW: number }) {
  return (
    <View style={[s.bannerInner, { width: bannerW }]}>
      {/* Team color bar */}
      <View style={[s.teamBar, { backgroundColor: TEAM_COLOR }]} />

      {/* Circuit map */}
      <View style={s.mapWrap}>
        <CircuitMap
          progress={state.prog}
          path={circuit.trackPath}
          accentColor={sectorColor(state.sector)}
          viewBoxWidth={circuit.viewBox?.width}
          viewBoxHeight={circuit.viewBox?.height}
          startRect={circuit.startRect}
          checkerFlagCenter={circuit.checkerFlagCenter}
          startLenOverride={circuit.startLenOverride}
        />
      </View>

      {/* Stats */}
      <StatsPanel state={state} />
    </View>
  );
}

// ─── Wave Banner ─────────────────────────────────────────────────────────────

function WaveBanner({ state, title, subtitle, bannerW, bannerH }: {
  state: PreviewState; title: string; subtitle?: string; bannerW: number; bannerH: number;
}) {
  return (
    <View style={[s.waveBannerInner, { width: bannerW, height: bannerH }]}>
      <WaveBackground color={TEAM_COLOR} width={bannerW} height={bannerH} />
      <View style={s.waveCenterContent}>
        <Text style={[s.waveTitle, { color: TEAM_COLOR }]}>{title}</Text>
        {subtitle ? <Text style={s.waveSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

// ─── Single State Card ────────────────────────────────────────────────────────

function StateCard({ state, circuit, bannerW }: {
  state: PreviewState; circuit: typeof CIRCUITS[0]; bannerW: number;
}) {
  const BANNER_H = 104;
  const isWave = state.pitPhase === 'boxbox' || state.pitPhase === 'fullPush';

  return (
    <View style={s.card}>
      <Text style={s.cardLabel}>{state.label}</Text>
      <View style={[s.banner, { width: bannerW, height: BANNER_H }]}>
        {isWave ? (
          state.pitPhase === 'boxbox' ? (
            <WaveBanner state={state} title="BOX BOX" subtitle="RECOVERY TIME" bannerW={bannerW} bannerH={BANNER_H} />
          ) : (
            <WaveBanner state={state} title="FULL PUSH" bannerW={bannerW} bannerH={BANNER_H} />
          )
        ) : (
          <NormalBanner state={state} circuit={circuit} bannerW={bannerW} />
        )}
      </View>
    </View>
  );
}

// ─── Circuit Selector ────────────────────────────────────────────────────────

function CircuitSelector({ selected, onSelect }: {
  selected: string; onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.circuitScroll} contentContainerStyle={s.circuitScrollContent}>
      {CIRCUITS.map(c => (
        <Pressable
          key={c.id}
          style={[s.circuitChip, selected === c.id && s.circuitChipActive]}
          onPress={() => onSelect(c.id)}
        >
          <Text style={[s.circuitChipText, selected === c.id && s.circuitChipTextActive]}>
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
  const H_PAD = 16;
  const bannerW = winW - H_PAD * 2;
  const [circuitId, setCircuitId] = useState('monaco');
  const circuit = CIRCUITS.find(c => c.id === circuitId) ?? CIRCUITS[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>LIVE ACTIVITY PREVIEW</Text>
          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Circuit selector */}
        <CircuitSelector selected={circuitId} onSelect={setCircuitId} />

        {/* State cards */}
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingHorizontal: H_PAD }]} showsVerticalScrollIndicator={false}>
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

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#0E0E12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
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
  closeBtnText: {
    color: PALETTE.white,
    fontSize: 14,
  },
  circuitScroll: {
    maxHeight: 40,
    marginBottom: 8,
  },
  circuitScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  circuitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  circuitChipActive: {
    backgroundColor: 'rgba(232,0,45,0.15)',
    borderColor: PALETTE.red,
  },
  circuitChipText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
  },
  circuitChipTextActive: {
    color: PALETTE.white,
  },
  scrollContent: {
    gap: 20,
  },
  card: {
    gap: 8,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Formula1-Regular',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  banner: {
    borderRadius: 20,
    backgroundColor: '#17171C',
    overflow: 'hidden',
  },

  // Normal banner
  bannerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  teamBar: {
    width: 3,
    borderRadius: 2,
    marginVertical: 8,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 10,
  },

  // Stats panel
  statsPanel: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  distNum: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  distKm: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 1,
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectorDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  paceText: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 14,
  },
  inPitLabel: {
    color: '#FF9900',
    fontFamily: 'Formula1-Bold',
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  elapsedText: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
  },
  tireBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tireText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
  },

  // Wave banner
  waveBannerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  waveCenterContent: {
    alignItems: 'center',
    gap: 2,
  },
  waveTitle: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    fontStyle: 'italic',
  },
  waveSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Formula1-Bold',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
