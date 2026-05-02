import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

interface ScreenHeaderProps {
  safeTop: number;
  flagAsset?: ImageSourcePropType;
  circuitLabel: string;
  circuitKm: number;
  hideKm?: boolean;
  theme: { line: string; text: string };
  statusLabel: string;
  statusColor?: string;
  statusOpacity?: number;
}

export default function ScreenHeader({
  safeTop,
  flagAsset,
  circuitLabel,
  circuitKm,
  hideKm = false,
  theme,
  statusLabel,
  statusColor,
  statusOpacity = 1,
}: ScreenHeaderProps) {
  const labelColor = statusColor ?? theme.text;
  const circuitText = hideKm
    ? circuitLabel.toUpperCase()
    : `${circuitLabel.toUpperCase()} (${circuitKm.toFixed(2)}km)`;

  return (
    <View style={[styles.header, { paddingTop: safeTop }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {flagAsset ? (
            <View style={styles.flagWrap}>
              <Image source={flagAsset} style={styles.flagImage} resizeMode="cover" />
            </View>
          ) : null}
          <Text style={[styles.circuitName, { color: theme.text }]} numberOfLines={1}>
            {circuitText}
          </Text>
        </View>
        <Text style={[styles.statusLabel, { color: labelColor, opacity: statusOpacity }]}>
          {statusLabel}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#17171C',
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  flagWrap: {
    width: 22,
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  flagImage: {
    width: '100%',
    height: '100%',
  },
  circuitName: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    letterSpacing: -0.34,
    flex: 1,
  },
  statusLabel: {
    fontFamily: 'Formula1-Bold',
    fontSize: 17,
    letterSpacing: -0.34,
  },
  divider: {
    height: 4,
    width: '100%',
  },
});
