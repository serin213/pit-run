import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '../hooks/useSafeTop';
import { useRunStore } from '../store/runStore';
import { useDistanceDisplayFont } from '../hooks/useDistanceDisplayFont';
import { useRunning } from '../hooks/useRunning';
import { fmtTime, fmtPace, fmtDist } from '../utils/format';
import { getDriverCode, getDriverDisplayName } from '../utils/driverCode';
import { COLORS } from '../constants/colors';
import { CIRCUIT_KM } from '../constants/tires';
import PauseButton from '../components/PauseButton';
import StopButton from '../components/StopButton';
import PlayButton from '../components/PlayButton';
import BoxBoxSheet from '../components/BoxBoxSheet';
import NameTag from '../components/NameTag';
import CircuitMap, {
  CIRCUIT_VIEWBOX,
  getCircuitPointAtProgress,
  getCircuitTangentAtProgress,
} from '../components/CircuitMap';
import { CIRCUITS } from '../config/circuits';
import { getCircuitTheme } from '../config/circuitThemes';
import { useAppStore } from '../store/appStore';
import type { RunningScreenProps as NavRunningScreenProps } from '../navigation/types';

const FW = 402;
const FH = 874;

const BTN_BG = {
  yellow: '#FFDD94',
  purple: '#B850FF',
  green: '#59B345',
} as const;

const BTN_ICON = {
  yellow: '#FCB827',
  purple: '#C26AFF',
  green: '#59B345',
} as const;

const PACE_FIT_SAMPLE = '99\'59"';
const STAT_VALUE_LINE_HEIGHT = 36;
const CONTROL_BUTTON_SIZE = 76;
const CONTROLS_TOP_SPACING = 20;
const CONTROLS_BOTTOM_SPACING = 32;
const SHOW_DEBUG_SECTOR_SWITCH = __DEV__;
const SHOW_DEBUG_CIRCUIT_SWITCH = __DEV__;
const BOXBOX_ALERT_MS = 4000;
const IN_PIT_DURATION_MS = 8000;
const FULL_PUSH_ALERT_MS = 4000;
const IN_PIT_PLAY_BUTTON = require('../../assets/control-buttons/inpit-play.png');
const IN_PIT_STOP_BUTTON = require('../../assets/control-buttons/inpit-stop.png');
const IN_PIT_PAUSE_BUTTON = require('../../assets/control-buttons/inpit-pause.png');


export default function RunningScreen({ navigation }: NavRunningScreenProps) {
  const { selectedCircuitId, profile: storeProfile, updatePaceRecord } = useAppStore();
  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const profile = storeProfile;
  const onStop = useCallback(() => navigation.replace('Result'), [navigation]);
  const onPaceSample = useCallback((pace: number) => updatePaceRecord(pace), [updatePaceRecord]);
  const { width: windowW, height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const [initialW] = useState(windowW);
  const [initialH] = useState(windowH);

  // Keep visual scale fixed to initially detected device size.
  const sx = initialW / FW;
  const sy = initialH / FH;
  const s = (v: number) => v * sx;
  const t = (v: number) => v * sy;

  const {
    distKm,
    elapsedMs,
    paceS,
    sector,
    prog,
    isPaused,
    boxBoxActive,
    pitPhase,
    pauseRun,
    resumeRun,
    stopRun,
    triggerBoxBox,
    startRun,
    closeBoxBox,
    setBoxBoxActive,
    setPitPhase,
    setSector,
  } = useRunStore();
  const pitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [debugCircuitIdx, setDebugCircuitIdx] = useState(() =>
    Math.max(0, CIRCUITS.findIndex((c) => c.id === circuit?.id)),
  );
  const activeCircuit = SHOW_DEBUG_CIRCUIT_SWITCH ? (CIRCUITS[debugCircuitIdx] ?? circuit) : circuit;

  useRunning();

  useEffect(() => {
    startRun();
  }, [startRun]);

  const cfg = COLORS.sector[sector];
  const isInPitTheme = pitPhase === 'inPit';
  const displayTheme = isInPitTheme
    ? { start: '#FFFFFF', end: '#CBCBCC' }
    : { start: cfg.start, end: cfg.end };
  const circuitLabel = activeCircuit?.displayName ?? 'Shanghai';
  const circuitKm = activeCircuit?.distanceKm ?? CIRCUIT_KM;
  const circuitPath = activeCircuit?.trackPath;
  const topTheme =
    isInPitTheme
      ? { line: '#FFFFFF', text: '#FFFFFF' }
      : getCircuitTheme(circuitLabel);
  const raceStatusLabel = isInPitTheme ? 'IN PIT' : isPaused ? 'PAUSED' : 'RACING';
  const topInfoTop = safeTop + 24;
  const topLineTop = safeTop + 58;
  const topLineBottom = topLineTop + 4;
  const nameTagLabel = getDriverCode(profile?.displayName ?? '');
  const boxBoxDriverName = getDriverDisplayName(profile?.displayName ?? '');
  const boxBoxTeamColor = profile?.nameTagAccentColor ?? '#E03A3E';

  const DIST_LEFT = 36; // fixed 36pt margin
  const DIST_RIGHT = windowW - DIST_LEFT;
  const distFrameWidth = DIST_RIGHT - DIST_LEFT;

  const [distRenderWidth, setDistRenderWidth] = useState<number>(0);
  const {
    fontSize: distFontSize,
    lineHeight: distLineHeight,
    sampleText: distFitSample,
    onSampleLayout: onDistSampleLayout,
  } = useDistanceDisplayFont(initialW);
  const distStartX = (DIST_LEFT + DIST_RIGHT) / 2 - distRenderWidth / 2;
  const distEndX = distStartX + distRenderWidth;

  const baseStatsLabelGap = 28;
  const baseValueGap = 8;
  const baseCircuitGap = 40;
  const statsLabelHeight = 13;

  const paceValue = fmtPace(paceS);
  const [paceMaxWidth, setPaceMaxWidth] = useState<number>(0);
  const [paceCurrentWidth, setPaceCurrentWidth] = useState<number>(0);
  const paceTextWidth = (paceMaxWidth > 0 ? paceMaxWidth : 84) + 2;
  const paceCurrentStartOffset = paceCurrentWidth > 0 ? paceCurrentWidth : (paceMaxWidth > 0 ? paceMaxWidth : 84);
  const paceRight = distRenderWidth > 0 ? distEndX : DIST_RIGHT;
  const paceLeft = paceRight - paceTextWidth;
  const paceLabelLeft = paceRight - paceCurrentStartOffset;

  const baseCircuitW = s(280.21);
  const baseCircuitH = t(180);
  const controlsBottomPadding = insets.bottom + CONTROLS_BOTTOM_SPACING;
  const controlsTop = windowH - (controlsBottomPadding + CONTROLS_TOP_SPACING + CONTROL_BUTTON_SIZE);
  const blockStartTop = topLineBottom + 10;
  const blockEndBottom = controlsTop - 10;
  const availableBlockHeight = Math.max(0, blockEndBottom - blockStartTop);
  const fixedBlockHeight =
    distLineHeight + baseStatsLabelGap + statsLabelHeight + baseValueGap + STAT_VALUE_LINE_HEIGHT + baseCircuitGap;
  const circuitHeightBudget = Math.max(0, availableBlockHeight - fixedBlockHeight);
  const circuitH = Math.min(baseCircuitH, circuitHeightBudget);
  const circuitScaleFallback = baseCircuitH > 0 ? Math.min(1, Math.max(0, circuitH / baseCircuitH)) : 1;
  const circuitW = Math.min(baseCircuitW * circuitScaleFallback, distFrameWidth);
  const blockHeight = fixedBlockHeight + circuitH;
  const blockTop = blockStartTop + Math.max(0, (availableBlockHeight - blockHeight) / 2);
  const distTop = blockTop;
  const statsLabelTop = distTop + distLineHeight + baseStatsLabelGap;
  const statsValueTop = statsLabelTop + statsLabelHeight + baseValueGap;
  const statsValueBottom = statsValueTop + STAT_VALUE_LINE_HEIGHT;
  const circuitLeft = DIST_LEFT + (distFrameWidth - circuitW) / 2;
  const circuitTop = statsValueBottom + baseCircuitGap;

  const cvbW = activeCircuit?.viewBox?.width ?? CIRCUIT_VIEWBOX.width;
  const cvbH = activeCircuit?.viewBox?.height ?? CIRCUIT_VIEWBOX.height;
  const circuitScale = Math.min(circuitW / cvbW, circuitH / cvbH);
  const circuitOffsetX = (circuitW - cvbW * circuitScale) / 2;
  const circuitOffsetY = (circuitH - cvbH * circuitScale) / 2;
  const circuitPoint = getCircuitPointAtProgress(prog, circuitPath);
  const tangent = getCircuitTangentAtProgress(prog, circuitPath);

  // Incoming side (where the drawn line reaches the tag)
  // is opposite to the forward tangent direction.
  const touchNx = -tangent.x;
  const touchNy = -tangent.y;
  const gradientX1 = 0.5 + 0.5 * touchNx;
  const gradientY1 = 0.5 + 0.5 * touchNy;
  const gradientX2 = 0.5 - 0.5 * touchNx;
  const gradientY2 = 0.5 - 0.5 * touchNy;

  const nameTagW = 47;
  const nameTagH = 26;
  const nameTagLeft = circuitLeft + circuitOffsetX + circuitPoint.x * circuitScale - nameTagW / 2;
  const nameTagTop = circuitTop + circuitOffsetY + circuitPoint.y * circuitScale - nameTagH / 2;

  const controlBgColor = BTN_BG[sector];
  const controlIconColor = BTN_ICON[sector];
  const statusTextColor = isInPitTheme || isPaused ? '#FFFFFF' : topTheme.text;
  const statusTextOpacity = isInPitTheme || isPaused ? 0.7 : 1;

  useEffect(() => {
    onPaceSample?.(paceS);
  }, [paceS, onPaceSample]);

  useEffect(() => {
    if (pitTimerRef.current) {
      clearTimeout(pitTimerRef.current);
      pitTimerRef.current = null;
    }

    if (pitPhase === 'boxbox') {
      pitTimerRef.current = setTimeout(() => {
        closeBoxBox();
        setPitPhase('inPit');
      }, BOXBOX_ALERT_MS);
    } else if (pitPhase === 'inPit') {
      pitTimerRef.current = setTimeout(() => {
        setPitPhase('fullPush');
        setBoxBoxActive(true);
      }, IN_PIT_DURATION_MS);
    } else if (pitPhase === 'fullPush') {
      pitTimerRef.current = setTimeout(() => {
        closeBoxBox();
        setPitPhase('none');
      }, FULL_PUSH_ALERT_MS);
    }

    return () => {
      if (pitTimerRef.current) {
        clearTimeout(pitTimerRef.current);
        pitTimerRef.current = null;
      }
    };
  }, [pitPhase, closeBoxBox, setBoxBoxActive, setPitPhase]);

  return (
    <View style={st.container}>
      <View style={[st.topInfoRow, { top: topInfoTop }]}>
        <View style={st.topInfoLeft}>
          {activeCircuit?.flagAsset ? (
            <View style={st.flagWrap}>
              <Image source={activeCircuit.flagAsset} style={st.flagImage} resizeMode="cover" />
            </View>
          ) : null}
          <Text style={[st.topTrackText, { color: topTheme.text }]}>
            {circuitLabel.toUpperCase()} ({circuitKm.toFixed(2)}km)
          </Text>
        </View>
        <Text style={[st.topStatusText, { color: statusTextColor, opacity: statusTextOpacity }]}>
          {raceStatusLabel}
        </Text>
      </View>
      <View style={[st.topDivider, { top: topLineTop, backgroundColor: topTheme.line }]} />

      <View style={[st.distCenterWrap, { top: distTop, left: DIST_LEFT, right: DIST_LEFT }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          allowFontScaling={false}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - distRenderWidth) > 0.5) setDistRenderWidth(w);
          }}
          style={[st.dist, { color: displayTheme.start, fontSize: distFontSize, lineHeight: distLineHeight }]}
        >
          {fmtDist(distKm)}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          st.hiddenMeasure,
          {
            fontFamily: 'Formula1-Black',
            fontSize: 130.2486572265625,
            lineHeight: 156,
            letterSpacing: 6.5,
          },
        ]}
        onLayout={onDistSampleLayout}
      >
        {distFitSample}
      </Text>

      <Text style={[st.lbl, { left: distStartX, top: statsLabelTop, fontSize: 13, lineHeight: 13 }]}>TIME</Text>
      <Text style={[st.val, { left: distStartX, top: statsValueTop, fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}>{fmtTime(elapsedMs)}</Text>

      <Text style={[st.lbl, { left: paceLabelLeft, top: statsLabelTop, fontSize: 13, lineHeight: 13 }]}>PACE</Text>
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        allowFontScaling={false}
        style={[
          st.val,
          {
            left: paceLeft,
            top: statsValueTop,
            width: paceTextWidth,
            textAlign: 'right',
            fontSize: 30,
            lineHeight: STAT_VALUE_LINE_HEIGHT,
          },
        ]}
      >
        {paceValue}
      </Text>

      <Text
        numberOfLines={1}
        allowFontScaling={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - paceMaxWidth) > 0.5) setPaceMaxWidth(w);
        }}
        style={[st.hiddenMeasure, { fontFamily: 'Formula1-Bold', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}
      >
        {PACE_FIT_SAMPLE}
      </Text>

      <Text
        numberOfLines={1}
        allowFontScaling={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - paceCurrentWidth) > 0.5) setPaceCurrentWidth(w);
        }}
        style={[st.hiddenMeasure, { fontFamily: 'Formula1-Bold', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}
      >
        {paceValue}
      </Text>

      <View
        style={{
          position: 'absolute',
          top: circuitTop,
          left: circuitLeft,
          width: circuitW,
          height: circuitH,
        }}
      >
        <CircuitMap
          progress={prog}
          startColor={displayTheme.start}
          endColor={displayTheme.end}
          path={circuitPath}
          accentColor={displayTheme.start}
          overlays={activeCircuit?.overlays}
          viewBoxWidth={activeCircuit?.viewBox?.width}
          viewBoxHeight={activeCircuit?.viewBox?.height}
        />
      </View>

      <View style={{ position: 'absolute', left: nameTagLeft, top: nameTagTop }}>
        <NameTag
          label={nameTagLabel}
          colorStart={displayTheme.end}
          colorEnd={displayTheme.start}
          accentColor={profile?.nameTagAccentColor ?? '#E03A3E'}
          gradientX1={gradientX1}
          gradientY1={gradientY1}
          gradientX2={gradientX2}
          gradientY2={gradientY2}
        />
      </View>

      {SHOW_DEBUG_SECTOR_SWITCH && (
        <View style={st.debugToolsWrap}>
          <Pressable onPress={triggerBoxBox} style={st.debugBoxBoxBtn}>
            <Text style={st.debugBoxBoxTxt}>BOX</Text>
          </Pressable>
          <Pressable onPress={() => setSector('yellow')} style={[st.debugSectorBtn, { backgroundColor: BTN_BG.yellow }]}>
            <Text style={st.debugSectorTxt}>Y</Text>
          </Pressable>
          <Pressable onPress={() => setSector('purple')} style={[st.debugSectorBtn, { backgroundColor: BTN_BG.purple }]}>
            <Text style={st.debugSectorTxt}>P</Text>
          </Pressable>
          <Pressable onPress={() => setSector('green')} style={[st.debugSectorBtn, { backgroundColor: BTN_BG.green }]}>
            <Text style={st.debugSectorTxt}>G</Text>
          </Pressable>
        </View>
      )}

      {SHOW_DEBUG_CIRCUIT_SWITCH && (
        <View style={st.debugCircuitWrap}>
          <Pressable
            onPress={() => setDebugCircuitIdx((i) => (i - 1 + CIRCUITS.length) % CIRCUITS.length)}
            style={st.debugCircuitArrow}
            hitSlop={8}
          >
            <Text style={st.debugCircuitArrowTxt}>◀</Text>
          </Pressable>
          <Text style={st.debugCircuitName} numberOfLines={1}>
            {activeCircuit?.displayName ?? '—'}
          </Text>
          <Pressable
            onPress={() => setDebugCircuitIdx((i) => (i + 1) % CIRCUITS.length)}
            style={st.debugCircuitArrow}
            hitSlop={8}
          >
            <Text style={st.debugCircuitArrowTxt}>▶</Text>
          </Pressable>
        </View>
      )}

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: CONTROLS_TOP_SPACING,
          paddingBottom: controlsBottomPadding,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        {isPaused ? (
          <>
            <Pressable
              onPress={() => {
                stopRun();
                onStop();
              }}
            >
              {isInPitTheme ? (
                <Image source={IN_PIT_STOP_BUTTON} style={st.inPitControlButton} resizeMode="contain" />
              ) : (
                <StopButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} sector={sector} />
              )}
            </Pressable>
            <Pressable onPress={resumeRun}>
              {isInPitTheme ? (
                <Image source={IN_PIT_PLAY_BUTTON} style={st.inPitControlButton} resizeMode="contain" />
              ) : (
                <PlayButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} sector={sector} />
              )}
            </Pressable>
          </>
        ) : (
          <Pressable onPress={pauseRun}>
            {isInPitTheme ? (
              <Image source={IN_PIT_PAUSE_BUTTON} style={st.inPitControlButton} resizeMode="contain" />
            ) : (
              <PauseButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} sector={sector} />
            )}
          </Pressable>
        )}
      </View>

      <BoxBoxSheet
        visible={boxBoxActive}
        mode={pitPhase === 'fullPush' ? 'fullPush' : 'boxbox'}
        driverName={boxBoxDriverName}
        teamColor={boxBoxTeamColor}
        onClose={closeBoxBox}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  topInfoRow: {
    position: 'absolute',
    left: 22,
    right: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagWrap: {
    width: 22,
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
  },
  flagImage: {
    width: '100%',
    height: '100%',
  },
  topTrackText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.34,
    includeFontPadding: false,
  },
  topStatusText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.34,
    includeFontPadding: false,
  },
  topDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
  },
  distCenterWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  dist: {
    fontFamily: 'Formula1-Black',
    letterSpacing: 6.5,
    includeFontPadding: false,
    textAlign: 'center',
  },
  lbl: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: -0.26,
    includeFontPadding: false,
  },
  val: {
    position: 'absolute',
    fontFamily: 'Formula1-Bold',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: -9999,
    includeFontPadding: false,
  },
  debugToolsWrap: {
    position: 'absolute',
    top: 44,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
    alignItems: 'center',
  },
  debugCircuitWrap: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 20,
  },
  debugCircuitArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  debugCircuitArrowTxt: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  debugCircuitName: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    includeFontPadding: false,
    maxWidth: 160,
    textAlign: 'center',
    opacity: 0.7,
  },
  debugBoxBoxBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCB827',
    backgroundColor: 'rgba(252,184,39,0.16)',
  },
  debugBoxBoxTxt: {
    color: '#FCB827',
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    lineHeight: 11,
    includeFontPadding: false,
  },
  debugSectorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  debugSectorTxt: {
    color: '#17171C',
    fontFamily: 'Formula1-Bold',
    fontSize: 11,
    lineHeight: 12,
    includeFontPadding: false,
  },
  inPitControlButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
  },
});
