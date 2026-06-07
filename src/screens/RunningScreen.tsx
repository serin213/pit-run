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
import { gpsDiag } from '../platform/gpsDiag';
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
const BOXBOX_ALERT_MS = 4000;
const FULL_PUSH_ALERT_MS = 4000;
const IN_PIT_PLAY_BUTTON = require('../../assets/control-buttons/inpit-play.png');
const IN_PIT_STOP_BUTTON = require('../../assets/control-buttons/inpit-stop.png');
const IN_PIT_PAUSE_BUTTON = require('../../assets/control-buttons/inpit-pause.png');


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
  const pitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // isPaused 연동: inPit 타이머 잔여시간 추적
  const pitTimerRemainingMsRef = useRef<number>(0);
  const pitTimerStartedAtRef = useRef<number>(0);
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
  // 미설정 시 PALETTE.yellow 폴백. 바텀싯이 떠있는 동안(pitPhase !== 'none')은 inPit 테마.
  const teamColor = storeProfile?.nameTagAccentColor ?? PALETTE.yellow;
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

  // activePlan 기반 회복 시간. fallback 60초 — 정상 흐름에서 activePlan은 항상 있어야
  // 함. null로 떨어지는 케이스는 race 시작 흐름의 set 누락 (FIX E 경고 로그가 추적).
  const inPitDurationMs = (activePlan?.recovery.durationSec ?? 60) * 1000;

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

  useEffect(() => {
    if (pitTimerRef.current) {
      clearTimeout(pitTimerRef.current);
      pitTimerRef.current = null;
    }

    let hapticTimer: ReturnType<typeof setTimeout> | null = null;

    if (pitPhase === 'boxbox') {
      playSound('boxbox');
      hapticTimer = setTimeout(() => doubleImpact(), 400);
      // FIX G: boxbox alert도 isPaused 연동 → 잔여 시간 추적용 ref 초기화.
      pitTimerRemainingMsRef.current = BOXBOX_ALERT_MS;
      pitTimerStartedAtRef.current = Date.now();
      pitTimerRef.current = setTimeout(() => {
        closeBoxBox();
        // FIX F: 마지막 랩이면 회복 스킵 → 바로 work 복귀 (none).
        // useRunning의 isFinalLap 분기가 boxbox 안 띄우고 finish 직행하는 게 정상이지만,
        // 마지막 사이클 직전 boxbox가 뜨고 그 사이 isFinalLap 트리거된 케이스 안전망.
        if (useRunStore.getState().isFinalLap) {
          setPitPhase('none');
        } else {
          setPitPhase('inPit');
        }
      }, BOXBOX_ALERT_MS);
    } else if (pitPhase === 'inPit') {
      // 잔여 시간 초기화 (isPaused 연동 useEffect에서 사용)
      pitTimerRemainingMsRef.current = inPitDurationMs;
      pitTimerStartedAtRef.current = Date.now();
      pitTimerRef.current = setTimeout(() => {
        setPitPhase('fullPush');
        setBoxBoxActive(true);
      }, inPitDurationMs);
    } else if (pitPhase === 'fullPush') {
      playSound('fullPush');
      hapticTimer = setTimeout(() => doubleImpact(), 400);
      // FIX G: fullPush alert도 isPaused 연동.
      pitTimerRemainingMsRef.current = FULL_PUSH_ALERT_MS;
      pitTimerStartedAtRef.current = Date.now();
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
      if (hapticTimer) clearTimeout(hapticTimer);
    };
  }, [pitPhase, closeBoxBox, setBoxBoxActive, setPitPhase, inPitDurationMs]);

  // FIX G: isPaused 연동 — boxbox/inPit/fullPush 모두 일시정지/재개. 잔여 시간 보존.
  //
  // 주의: pitPhase도 deps에 포함 — pitPhase가 새 phase로 바뀔 때 이 effect가 실행되지만,
  // 그 시점에는 pitPhase effect가 먼저 타이머를 시작해 pitTimerRef.current != null.
  // resume 분기의 `if (pitTimerRef.current === null)` 가드가 중복 타이머 시작을 막음.
  // (pitPhase effect와 순서: pitPhase effect → isPaused effect 순으로 실행 보장)
  useEffect(() => {
    if (pitPhase !== 'inPit' && pitPhase !== 'boxbox' && pitPhase !== 'fullPush') return;
    if (isPaused) {
      // 타이머 중지 + 잔여 시간 갱신
      if (pitTimerRef.current) {
        clearTimeout(pitTimerRef.current);
        pitTimerRef.current = null;
        const elapsed = Date.now() - pitTimerStartedAtRef.current;
        pitTimerRemainingMsRef.current = Math.max(0, pitTimerRemainingMsRef.current - elapsed);
      }
    } else {
      // 일시정지에서 재개: pitTimerRef가 null일 때만 시작 (pause가 타이머를 지운 경우).
      // pitPhase 전환 시에는 pitPhase effect가 이미 타이머를 시작했으므로 스킵.
      if (pitTimerRef.current === null) {
        pitTimerStartedAtRef.current = Date.now();
        pitTimerRef.current = setTimeout(() => {
          if (pitPhase === 'boxbox') {
            closeBoxBox();
            if (useRunStore.getState().isFinalLap) {
              setPitPhase('none');
            } else {
              setPitPhase('inPit');
            }
          } else if (pitPhase === 'inPit') {
            setPitPhase('fullPush');
            setBoxBoxActive(true);
          } else if (pitPhase === 'fullPush') {
            closeBoxBox();
            setPitPhase('none');
          }
        }, pitTimerRemainingMsRef.current);
      }
    }
  }, [isPaused, pitPhase, closeBoxBox, setBoxBoxActive, setPitPhase]);

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
                <StopButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} useImage />
              )}
            </Pressable>
            <Pressable onPress={resumeRun}>
              {isInPitTheme ? (
                <Image source={IN_PIT_PLAY_BUTTON} style={styles.inPitControlButton} resizeMode="contain" />
              ) : (
                <PlayButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} useImage />
              )}
            </Pressable>
          </>
        ) : (
          <Pressable onPress={pauseRun}>
            {isInPitTheme ? (
              <Image source={IN_PIT_PAUSE_BUTTON} style={styles.inPitControlButton} resizeMode="contain" />
            ) : (
              <PauseButton color={controlIconColor} bgColor={controlBgColor} size={CONTROL_BUTTON_SIZE} useImage />
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

function BgEventDiagPanel() {
  const [, setDiagTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDiagTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // FIX 5: race 시작 직후 plan 핵심값 확인용. iKm/reps/recS를 같이 표시해서
  // 잘못된 baseIntervalM 또는 grade factor로 인터벌이 너무 짧은 케이스 식별 가능.
  const plan = useAppStore.getState().activePlan;
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
      pointerEvents="none"
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>BG EVENTS</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>call: {gpsDiag.bgEventCallCount}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>null: {gpsDiag.bgEventPlanNull}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>bb: {gpsDiag.bgEventBoxBoxFired}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>fp: {gpsDiag.bgEventFullPushFired}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>nr: {gpsDiag.bgEventWorkNotReady}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>nw: {gpsDiag.bgEventNotWorkPhase}</Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>q: {gpsDiag.bgEventQualifying}</Text>
      <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>
        iKm: {plan?.intervals.distanceM != null ? (plan.intervals.distanceM / 1000).toFixed(2) : '?'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>
        reps: {plan?.intervals.reps ?? '?'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 10 }}>
        recS: {plan?.recovery.durationSec ?? '?'}
      </Text>
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
