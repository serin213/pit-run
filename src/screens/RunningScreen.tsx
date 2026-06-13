import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '../hooks/useSafeTop';
import { useRunStore } from '../store/runStore';
import { useDistanceDisplayFont } from '../hooks/useDistanceDisplayFont';
import { useRunning } from '../hooks/useRunning';
import { useGPS } from '../hooks/useGPS';
import { fmtTime, fmtPace, fmtDist } from '../utils/format';
import { getDriverCode, getDriverDisplayName } from '../utils/driverCode';
import { COLORS, PALETTE} from '../constants/colors';
import { LETTER_SPACING } from '../constants/typography';
import { DEFAULT_CIRCUIT_KM as CIRCUIT_KM } from '../config/circuits';
import PauseButton from '../components/PauseButton';
import StopButton from '../components/StopButton';
import PlayButton from '../components/PlayButton';
import BoxBoxSheet from '../components/BoxBoxSheet';
import NameTag from '../components/NameTag';
import ScreenHeader from '../components/ScreenHeader';
import CircuitMap, {
  CIRCUIT_VIEWBOX,
  getCircuitPointAtProgress,
  getCircuitTangentAtProgress,
} from '../components/CircuitMap';
import { CIRCUITS } from '../config/circuits';
import { getCircuitTheme } from '../config/circuitThemes';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useDevMode } from '../lib/devMode';
import type { RunningScreenProps as NavRunningScreenProps } from '../navigation/types';
import { logRaceAbandoned } from '../lib/analytics/raceEvents';
import { playSound } from '../platform/audio';
import { gpsDiag, laDiag, cbLog } from '../platform/gpsDiag';
import { debugGpsConfig } from '../platform/debugGpsConfig';
import { isBackgroundActivitySupported } from '../platform/backgroundActivity';
import { syncDiag } from '../api/saveDiag';
import { doubleImpact, successLong } from '../platform/haptics';
import { endAllLiveActivities } from '../platform/liveActivity';

const FW = 402;
const FH = 874;

// 묶음 1b: BTN_BG/BTN_ICON sector 키 룩업 객체 제거. controlBgColor / controlIconColor는
// isInPitTheme + teamColor 기반으로 인라인 계산.

const PACE_FIT_SAMPLE = '99\'59"';
const STAT_VALUE_LINE_HEIGHT = 36;
const CONTROL_BUTTON_SIZE = 76;
const CONTROLS_TOP_SPACING = 20;
const CONTROLS_BOTTOM_SPACING = 32;
// 묶음 2: BOXBOX_ALERT_MS / FULL_PUSH_ALERT_MS / pitTimerRef / inPitDurationMs 제거.
// alert phase 타이밍은 background plan의 lastFiredAtMs + 4초 ALERT_MS로 derive됨
// (useRunning polling). RunningScreen은 사운드·진동만 발화.
// 묶음 1b-LA 보완: inpit-*.png → *-white.png rename 후속. 변수명은 inPit 시각 분기
// 의도를 유지 위해 그대로. 사용처(loop 안 inPit 분기)는 손대지 않음.
const IN_PIT_PLAY_BUTTON = require('../../assets/control-buttons/play-white.png');
const IN_PIT_STOP_BUTTON = require('../../assets/control-buttons/stop-white.png');
const IN_PIT_PAUSE_BUTTON = require('../../assets/control-buttons/pause-white.png');


export default function RunningScreen({ navigation }: NavRunningScreenProps) {
  const { selectedCircuitId, profile: storeProfile, updatePaceRecord, currentRaceEventId, activePlan } = useAppStore();
  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const profile = storeProfile;
  // 시작 시점 INSERT 안 함. ResultScreen.handleConfirm에서 distKm >= 0.10일 때만 INSERT.
  // started_at는 elapsedMs 역산으로 계산하므로 별도 ref 불필요.
  // → <0.10km로 중단된 레이스는 DB에 row 자체가 안 만들어짐.
  const { user } = useAuthStore();
  const { isDevMode } = useDevMode();
  // 0.10km 미만은 결과 화면도 안 보여주고 곧바로 홈.
  // 시작 시점에 DB 행을 만들지 않으므로 삭제할 것도 없음.
  //
  // LA 종료: STOP은 항상 endAllLiveActivities를 먼저 호출. Result 분기에서도
  // 호출하는 게 idempotent해서 안전하고, <0.10km로 Home으로 직행하는 경로에서는
  // 여기서 안 끊으면 잠금화면 LA가 영구히 남는 버그 fix.
  // 자동완주(handleAutoFinish)는 건드리지 않음 — ResultScreen 진입 시 종료.
  // navigation.replace('Result')가 두 번 호출되는 케이스 방어. 자동완주(handleAutoFinish)
  // 와 수동 정지(onStop)가 거의 동시에 발생하면 둘 다 navigate → Result re-mount →
  // autoSavedRef per-instance라 reset → save 두 번 호출 → DB 중복 row.
  // shared ref로 navigate 1회만 보장.
  const navigatedToResultRef = useRef(false);
  const navigateToResult = useCallback(() => {
    if (navigatedToResultRef.current) return;
    navigatedToResultRef.current = true;
    navigation.replace('Result');
  }, [navigation]);

  const onStop = useCallback(() => {
    endAllLiveActivities().catch(() => {});
    const currentDistKm = useRunStore.getState().distKm;
    if (currentDistKm < 0.10) {
      navigation.replace('Home');
      return;
    }
    navigateToResult();
  }, [navigation, navigateToResult]);
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
    prog,
    isRunning,
    isPaused,
    boxBoxActive,
    pitPhase,
    isFinalLap,
    pauseRun,
    resumeRun,
    stopRun,
    triggerBoxBox,
    startRun,
    closeBoxBox,
    setBoxBoxActive,
    setPitPhase,
  } = useRunStore();
  // 묶음 2: pitTimer ref 3개 제거 — setTimeout 분기 자체 폐기. plan-driven polling이
  // pitPhase/boxBoxActive를 store에 sync.
  const backgroundOpacity = useRef(new Animated.Value(1)).current;

  const handleVisibilityChange = useCallback((v: boolean) => {
    Animated.timing(backgroundOpacity, {
      toValue: v ? 0.2 : 1.0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [backgroundOpacity]);

  const [debugCircuitIdx, setDebugCircuitIdx] = useState(() =>
    Math.max(0, CIRCUITS.findIndex((c) => c.id === circuit?.id)),
  );
  const activeCircuit = isDevMode ? (CIRCUITS[debugCircuitIdx] ?? circuit) : circuit;

  const autoFinishedRef = useRef(false);
  const handleFinalLap = useCallback(() => {
    playSound('finalLap');
    doubleImpact();
  }, []);
  const handleAutoFinish = useCallback(() => {
    if (autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    playSound('chequeredFlag');
    successLong();
    setPitPhase('completed');
    setBoxBoxActive(true);
    stopRun();
    navigateToResult();
  }, [navigateToResult, setPitPhase, setBoxBoxActive, stopRun]);
  useRunning({ onFinalLap: handleFinalLap, onFinish: handleAutoFinish });
  // isPaused는 GPS 조건에서 제외 — 화면 잠금 시 isPaused가 순간 true로 흔들려도
  // background task가 종료되지 않도록. pause 중 거리 누적 차단은 addGpsDistance에서 처리.
  useGPS(isRunning, (d) => useRunStore.getState().addGpsDistance(d));

  useEffect(() => {
    startRun();
  }, [startRun]);

  // 묶음 1b: sector 시스템 제거. accent는 teamColor(profile.nameTagAccentColor) 우선,
  // 미설정 시 PALETTE.red 폴백 (Swift teamColorName / RN HEX_TO_NAME / LA payload
  // 전체 일관성). 바텀싯이 떠있는 동안(pitPhase !== 'none')은 inPit 테마.
  const teamColor = storeProfile?.nameTagAccentColor ?? PALETTE.red;
  const isInPitTheme = pitPhase !== 'none';
  const displayTheme = isInPitTheme
    ? { start: PALETTE.white, end: '#CBCBCC' }
    : { start: teamColor, end: teamColor };
  const circuitLabel = activeCircuit?.displayName ?? 'Shanghai';
  const circuitKm = activeCircuit?.distanceKm ?? CIRCUIT_KM;
  const circuitPath = activeCircuit?.trackPath;
  const topTheme =
    isInPitTheme
      ? { line: PALETTE.white, text: PALETTE.white }
      : getCircuitTheme(circuitLabel);
  const raceStatusLabel = isInPitTheme ? 'IN PIT' : isPaused ? 'PAUSED' : isFinalLap ? 'FINAL LAP' : 'RACING';
  const topLineTop = safeTop + 48;
  const topLineBottom = topLineTop + 4;
  const nameTagLabel = getDriverCode(profile?.displayName ?? '');
  const boxBoxDriverName = getDriverDisplayName(profile?.displayName ?? '');
  const boxBoxTeamColor = profile?.nameTagAccentColor ?? PALETTE.red;

  const DIST_LEFT = 36; // fixed 36pt margin
  const DIST_RIGHT = windowW - DIST_LEFT;
  const distFrameWidth = DIST_RIGHT - DIST_LEFT;

  const [distRenderWidth, setDistRenderWidth] = useState<number>(0);
  const [distanceWidth, setDistanceWidth] = useState<number>(0);
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
  const paceRight = distRenderWidth > 0 ? distEndX : DIST_RIGHT;
  const paceLeft = paceRight - paceTextWidth;


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
  const circuitPoint = getCircuitPointAtProgress(prog, circuitPath, activeCircuit?.startRect, activeCircuit?.checkerFlagCenter);
  const tangent = getCircuitTangentAtProgress(prog, circuitPath, activeCircuit?.startRect, activeCircuit?.checkerFlagCenter);

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

  // 묶음 1b: sector 키 룩업 → teamColor 단일화. pit in 회색 처리는 isInPitTheme 기준.
  const controlBgColor = isInPitTheme ? PALETTE.grey : teamColor;
  const controlIconColor = isInPitTheme ? PALETTE.white : teamColor;
  const statusTextColor = isInPitTheme || isPaused ? PALETTE.white : topTheme.text;
  const statusTextOpacity = isInPitTheme || isPaused ? 0.7 : 1;

  useEffect(() => {
    onPaceSample?.(paceS);
  }, [paceS, onPaceSample]);

  // 묶음 2: inPitDurationMs 변수 제거. background plan.recoveryDurationMs가 single source.

  // FIX E: race 진입 시 activePlan이 null이면 회복 시간이 60초 fallback으로 가버림.
  // Xcode Console.app 또는 react-native log-ios로 확인 가능 — race 시작 흐름의
  // setActivePlan 누락 위치 추적용.
  useEffect(() => {
    if (isRunning && !activePlan) {
      console.warn(
        '[RunningScreen] CRITICAL: race started but activePlan is null. ' +
        'Recovery will fallback to 60s. Check race start flow.',
      );
    }
  }, [isRunning, activePlan]);

  // 외출① 보완: 사운드는 background(locationTask.ts)에서만 발화 (잠금 중에도 정상
  // 작동 확인됨). foreground에서 중복 호출하면 audio session이 같은 sound key seekTo(0)
  // + play로 첫 사운드를 자르고 다시 재시작 → 사용자가 비정상으로 인식. playSound 제거.
  // haptic은 foreground에서만 발동 (잠금 중 진동 의미 없음, 풀스크린 시각 보조).
  useEffect(() => {
    if (pitPhase === 'boxbox' || pitPhase === 'fullPush') {
      const haptic = setTimeout(() => doubleImpact(), 400);
      return () => clearTimeout(haptic);
    }
    return undefined;
  }, [pitPhase]);

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backgroundOpacity }]}>
      <ScreenHeader
        safeTop={safeTop}
        flagAsset={activeCircuit?.flagAsset}
        circuitLabel={circuitLabel}
        circuitKm={circuitKm}
        theme={topTheme}
        statusLabel={raceStatusLabel}
        statusColor={statusTextColor}
        statusOpacity={statusTextOpacity}
      />

      <View style={[styles.distCenterWrap, { top: distTop, left: DIST_LEFT, right: DIST_LEFT }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          allowFontScaling={false}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - distRenderWidth) > 0.5) setDistRenderWidth(w);
            if (w > 0 && Math.abs(w - distanceWidth) > 0.5) setDistanceWidth(w);
          }}
          style={[styles.dist, { color: displayTheme.start, fontSize: 120, lineHeight: distLineHeight, alignSelf: 'center' }]}
        >
          {fmtDist(distKm)}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.hiddenMeasure,
          {
            fontFamily: 'Formula1-Black',
            fontSize: 130.2486572265625,
            lineHeight: 156,
            letterSpacing: LETTER_SPACING.caption(130),
          },
        ]}
        onLayout={onDistSampleLayout}
      >
        {distFitSample}
      </Text>

      {distanceWidth > 0 && (
        <View style={{ position: 'absolute', top: statsLabelTop, width: distanceWidth, alignSelf: 'center' }}>
          <Text style={[styles.lbl, { left: 0, top: 0, fontSize: 13, lineHeight: 13 }]}>TIME</Text>
          <Text style={[styles.val, { left: 0, top: statsValueTop - statsLabelTop, fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}>{fmtTime(elapsedMs)}</Text>
          <View style={{ position: 'absolute', right: 0, top: 0, alignItems: 'flex-start' }}>
            <Text style={[styles.lbl, { position: 'relative', fontSize: 13, lineHeight: 13, marginLeft: 1 }]}>PACE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: baseValueGap }}>
              <Text allowFontScaling={false} style={[styles.val, { position: 'relative', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT, fontVariant: ['tabular-nums'] }]}>
                {paceValue.split("'")[0]}
              </Text>
              <View><Text allowFontScaling={false} style={[styles.val, { position: 'relative', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT, fontVariant: undefined }]}>{"'"}</Text></View>
              <Text allowFontScaling={false} style={[styles.val, { position: 'relative', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT, fontVariant: ['tabular-nums'] }]}>
                {(paceValue.split("'")[1] ?? '').replace('"', '')}
              </Text>
              <View><Text allowFontScaling={false} style={[styles.val, { position: 'relative', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT, fontVariant: undefined }]}>{'"'}</Text></View>
            </View>
          </View>
        </View>
      )}

      <Text
        numberOfLines={1}
        allowFontScaling={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - paceMaxWidth) > 0.5) setPaceMaxWidth(w);
        }}
        style={[styles.hiddenMeasure, { fontFamily: 'Formula1-Bold', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}
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
        style={[styles.hiddenMeasure, { fontFamily: 'Formula1-Bold', fontSize: 30, lineHeight: STAT_VALUE_LINE_HEIGHT }]}
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
          startColor={isInPitTheme ? PALETTE.grey : displayTheme.start}
          path={circuitPath}
          accentColor={isInPitTheme ? PALETTE.grey : displayTheme.start}
          overlays={activeCircuit?.overlays}
          viewBoxWidth={activeCircuit?.viewBox?.width}
          viewBoxHeight={activeCircuit?.viewBox?.height}
          startRect={activeCircuit?.startRect}
          checkerFlagCenter={activeCircuit?.checkerFlagCenter}
          startLenOverride={activeCircuit?.startLenOverride}
        />
      </View>

      <View style={{ position: 'absolute', left: nameTagLeft, top: nameTagTop }}>
        <NameTag
          label={nameTagLabel}
          colorStart={displayTheme.end}
          colorEnd={displayTheme.start}
          accentColor={profile?.nameTagAccentColor ?? PALETTE.red}
          gradientX1={gradientX1}
          gradientY1={gradientY1}
          gradientX2={gradientX2}
          gradientY2={gradientY2}
        />
      </View>

      {isDevMode && (
        <View style={styles.debugToolsWrap}>
          <Pressable
            onPress={triggerBoxBox}
            disabled={pitPhase !== 'none'}
            style={[styles.debugBoxBoxBtn, pitPhase !== 'none' && { opacity: 0.4 }]}
          >
            <Text style={styles.debugBoxBoxTxt}>BOX BOX</Text>
          </Pressable>
          {/* 묶음 1b: sector 전환 디버그 버튼 3개 (Y/P/G) 제거 — sector 시스템 폐기 */}
        </View>
      )}

      {isDevMode && (
        <View style={styles.debugCircuitWrap}>
          <Pressable
            onPress={() => setDebugCircuitIdx((i) => (i - 1 + CIRCUITS.length) % CIRCUITS.length)}
            style={styles.debugCircuitArrow}
            hitSlop={8}
          >
            <Text style={styles.debugCircuitArrowTxt}>◀</Text>
          </Pressable>
          <Text style={styles.debugCircuitName} numberOfLines={1}>
            {activeCircuit?.displayName ?? '—'}
          </Text>
          <Pressable
            onPress={() => setDebugCircuitIdx((i) => (i + 1) % CIRCUITS.length)}
            style={styles.debugCircuitArrow}
            hitSlop={8}
          >
            <Text style={styles.debugCircuitArrowTxt}>▶</Text>
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
                if (user?.id && currentRaceEventId) {
                  logRaceAbandoned({
                    raceStartedEventId: currentRaceEventId,
                    userId: user.id,
                    abandonedAtRep: 0,
                    reasonCode: 'user_quit',
                  }).catch(() => {});
                }
                onStop();
              }}
            >
              {isInPitTheme ? (
                <Image source={IN_PIT_STOP_BUTTON} style={styles.inPitControlButton} resizeMode="contain" />
              ) : (
                <StopButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} teamColor={teamColor} />
              )}
            </Pressable>
            <Pressable onPress={resumeRun}>
              {isInPitTheme ? (
                <Image source={IN_PIT_PLAY_BUTTON} style={styles.inPitControlButton} resizeMode="contain" />
              ) : (
                <PlayButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} teamColor={teamColor} />
              )}
            </Pressable>
          </>
        ) : (
          <Pressable onPress={pauseRun}>
            {isInPitTheme ? (
              <Image source={IN_PIT_PAUSE_BUTTON} style={styles.inPitControlButton} resizeMode="contain" />
            ) : (
              <PauseButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} teamColor={teamColor} />
            )}
          </Pressable>
        )}
      </View>

      </Animated.View>
      <BoxBoxSheet
        visible={boxBoxActive}
        mode={pitPhase === 'fullPush' ? 'fullPush' : 'boxbox'}
        driverName={boxBoxDriverName}
        teamColor={boxBoxTeamColor}
        onClose={closeBoxBox}
        onVisibilityChange={handleVisibilityChange}
      />

      {/* ── BG event 진단 패널 — TestFlight에서도 표시 (출시 직전 제거 예정) ──
       *  카운터는 module-level mutable이라 RN re-render를 트리거 안 함.
       *  diagTick state를 1초마다 갱신해 최신 값 표시 강제. */}
      <BgEventDiagPanel />
    </View>
  );
}

function formatCbLogSummary(): string {
  if (cbLog.length === 0) return '—';
  const now = Date.now();
  // 마지막 bg or fg 마커 인덱스 탐색
  let markerIdx = -1;
  let markerKind: 'bg' | 'fg' = 'bg';
  for (let i = cbLog.length - 1; i >= 0; i--) {
    if (cbLog[i].k === 'bg' || cbLog[i].k === 'fg') {
      markerIdx = i;
      markerKind = cbLog[i].k as 'bg' | 'fg';
      break;
    }
  }
  if (markerIdx === -1) return 'no marker';
  const cbs = cbLog.slice(markerIdx + 1).filter((e) => e.k === 'cb');
  const markerT = cbLog[markerIdx].t;
  const gaps = cbs.map((e, i) => {
    const prev = i === 0 ? markerT : cbs[i - 1].t;
    return Math.round((e.t - prev) / 1000);
  });
  const lastCbT = cbs.length > 0 ? cbs[cbs.length - 1].t : markerT;
  const silentSec = Math.round((now - lastCbT) / 1000);
  const gapsStr = gaps.length > 0 ? gaps.join(' ') : '(none)';
  return `${markerKind}→ ${gapsStr} (${silentSec}s)`;
}

function BgEventDiagPanel() {
  const [, setDiagTick] = useState(0);
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDiagTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // 외출① 보완: useAppStore.getState() (non-reactive snapshot) → reactive subscribe로 전환.
  // 기존 패턴은 mount 시점 1회만 plan 캡처 → race 시작 후 setActivePlan 호출돼도 패널이
  // 다시 mount되지 않으면 영원히 "?" 표시. activePlan을 reactive로 subscribe하면 store
  // 갱신 즉시 re-render → 정상값 표시.
  const activePlan = useAppStore((s) => s.activePlan);
  return (
    <View
      style={{
        position: 'absolute',
        top: 100,
        right: 8,
        zIndex: 9999,
        padding: 8,
        backgroundColor: 'rgba(255,0,0,0.75)',
        borderRadius: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>GPS</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>tw: {gpsDiag.taskWriteCount}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>acc: {gpsDiag.acceptCount}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>skip: {gpsDiag.distSkipCount}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>started: {gpsDiag.taskStarted ? '1' : '0'}</Text>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 }}>BG EVENTS</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>call: {gpsDiag.bgEventCallCount}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>null: {gpsDiag.bgEventPlanNull}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>bb: {gpsDiag.bgEventBoxBoxFired}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>fp: {gpsDiag.bgEventFullPushFired}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>nr: {gpsDiag.bgEventWorkNotReady}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>nw: {gpsDiag.bgEventNotWorkPhase}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>q: {gpsDiag.bgEventQualifying}</Text>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 }}>LA</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>tried: {laDiag.pushTried}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>ok: {laDiag.pushOk}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>fail: {laDiag.pushFail}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>bgSess: {isBackgroundActivitySupported() ? (gpsDiag.bgSessionActive ? '1' : '0') : 'n/a'}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>lockT: {laDiag.lockTransitions}</Text>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 }}>SYNC</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>profile: {syncDiag.profileOk ? '1' : '0'}{syncDiag.profileErr ? ` ${syncDiag.profileErr.slice(0, 20)}` : ''}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>qual: {syncDiag.qualifyingOk ? '1' : '0'}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>actDts: {syncDiag.activityDatesOk ? '1' : '0'}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>totalKm: {syncDiag.totalDistanceOk ? '1' : '0'}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>flush: {syncDiag.flushOk ? '1' : '0'}</Text>
      <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>
        iKm: {activePlan?.intervals.distanceM != null ? (activePlan.intervals.distanceM / 1000).toFixed(2) : '?'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>
        reps: {activePlan?.intervals.reps ?? '?'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>
        recS: {activePlan?.recovery.durationSec ?? '?'}
      </Text>
      {/* A/B 토글 — 다음 GPS 시작 시 적용 */}
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 }}>A/B (next start)</Text>
      <Pressable onPress={() => { debugGpsConfig.useFitnessActivityType = !debugGpsConfig.useFitnessActivityType; forceRender((n) => n + 1); }}>
        <Text style={{ color: '#ff0', fontSize: 10 }}>AT:{debugGpsConfig.useFitnessActivityType ? 'Fitness' : 'Other'}</Text>
      </Pressable>
      <Pressable onPress={() => { debugGpsConfig.useBgSession = !debugGpsConfig.useBgSession; forceRender((n) => n + 1); }}>
        <Text style={{ color: '#ff0', fontSize: 10 }}>bgSess:{debugGpsConfig.useBgSession ? 'on' : 'off'}</Text>
      </Pressable>
      {/* cbLog 요약 */}
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 }}>CB</Text>
      <Text style={{ color: '#aff', fontSize: 9 }} numberOfLines={2}>{formatCbLogSummary()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  distCenterWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  dist: {
    fontFamily: 'Formula1-Black',
    letterSpacing: LETTER_SPACING.caption(130),
    includeFontPadding: false,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  lbl: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    color: COLORS.text.dim,
    letterSpacing: LETTER_SPACING.display(13),
    includeFontPadding: false,
  },
  val: {
    position: 'absolute',
    fontFamily: 'Formula1-Bold',
    color: PALETTE.white,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
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
    bottom: 170,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugCircuitWrap: {
    position: 'absolute',
    bottom: 130,
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
    color: PALETTE.white,
    fontSize: 14,
  },
  debugCircuitName: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 12,
    letterSpacing: LETTER_SPACING.caption(12),
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
    borderColor: PALETTE.yellow,
    backgroundColor: 'rgba(252,184,39,0.16)',
  },
  debugBoxBoxTxt: {
    color: PALETTE.yellow,
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    lineHeight: 11,
    includeFontPadding: false,
  },
  // 묶음 1b: debugSectorBtn/Txt 스타일 제거 — sector 전환 디버그 버튼 폐기.
  inPitControlButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
  },
});
