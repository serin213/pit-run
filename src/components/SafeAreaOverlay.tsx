import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iPhone 16 Pro reference values used as fallback
const DEFAULT_STATUS_H = 59;
const DEFAULT_HOME_H = 34;
const DI_TOP = 11;
const DI_H = 37;
const DI_W = 126;

function getTimeStr(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function BatteryIcon() {
  return (
    <Svg width={25} height={12} viewBox="0 0 25 12">
      <Rect x={0.5} y={0.5} width={21} height={11} rx={3.5} stroke="#FFFFFF" strokeWidth={1} fill="none" />
      <Rect x={22} y={3.5} width={2} height={5} rx={1} fill="#FFFFFF" opacity={0.5} />
      <Rect x={2} y={2} width={17} height={8} rx={2} fill="#FFFFFF" />
    </Svg>
  );
}

function WifiIcon() {
  return (
    <Svg width={16} height={12} viewBox="0 0 16 12">
      <Path d="M 0.5 4.5 A 8.5 8.5 0 0 1 15.5 4.5" stroke="#FFFFFF" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Path d="M 2.8 7 A 5.5 5.5 0 0 1 13.2 7" stroke="#FFFFFF" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Path d="M 5.2 9.5 A 3 3 0 0 1 10.8 9.5" stroke="#FFFFFF" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={8} cy={11.5} r={1} fill="#FFFFFF" />
    </Svg>
  );
}

function SignalIcon() {
  return (
    <Svg width={17} height={12} viewBox="0 0 17 12">
      <Rect x={0} y={9} width={3} height={3} rx={0.5} fill="#FFFFFF" />
      <Rect x={4.5} y={6} width={3} height={6} rx={0.5} fill="#FFFFFF" />
      <Rect x={9} y={3} width={3} height={9} rx={0.5} fill="#FFFFFF" />
      <Rect x={13.5} y={0} width={3} height={12} rx={0.5} fill="#FFFFFF" />
    </Svg>
  );
}

export default function SafeAreaOverlay() {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState(getTimeStr);

  // Use real insets if available; fall back to iPhone 16 Pro defaults
  const statusH = insets.top > 0 ? insets.top : DEFAULT_STATUS_H;
  const homeH = insets.bottom > 0 ? insets.bottom : DEFAULT_HOME_H;
  const hasDI = statusH >= 50;

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeStr()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* ── Status bar ── */}
      <View style={[styles.statusArea, { height: statusH }]}>
        {hasDI && (
          <View
            style={[
              styles.dynamicIsland,
              { top: DI_TOP, width: DI_W, height: DI_H },
            ]}
          />
        )}
        <View
          style={[
            styles.statusContent,
            { top: hasDI ? DI_TOP : 0, height: hasDI ? DI_H : statusH },
          ]}
        >
          <Text style={styles.timeText} allowFontScaling={false}>
            {time}
          </Text>
          <View style={styles.statusIcons}>
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </View>
        </View>
      </View>

      {/* ── Home indicator ── */}
      <View style={[styles.homeArea, { height: homeH }]}>
        <View style={styles.homeIndicatorPill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  statusArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#17171C',
  },
  dynamicIsland: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  statusContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  homeIndicatorPill: {
    width: 134,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
});
