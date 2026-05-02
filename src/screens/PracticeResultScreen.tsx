import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import GradientCtaButton from '../components/GradientCtaButton';
import type { PracticeResultScreenProps } from '../navigation/types';

const RACE_FLAG = require('../../assets/practice-race-flag.png');

const CTA_H = 44;

export default function PracticeResultScreen({ navigation, route }: PracticeResultScreenProps) {
  const { distanceKm } = route.params;
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();
  const { width: windowW } = useWindowDimensions();

  const ctaBottom = safeBottom + 20;
  const flagBottom = ctaBottom + CTA_H + 36;

  return (
    <View style={styles.container}>
      {/* 거리 + km */}
      <View style={[styles.topContent, { paddingTop: safeTop + 130 }]}>
        <View style={styles.distanceRow}>
          <Text style={styles.distanceNum} allowFontScaling={false}>
            {distanceKm.toFixed(2)}
          </Text>
          <Text style={styles.distanceUnit}>km</Text>
        </View>

        {/* 메시지 */}
        <Text style={styles.message}>
          {'Good run.\nSee you on track.'}
        </Text>
      </View>

      {/* 깃발 이미지 */}
      <Image
        source={RACE_FLAG}
        style={[styles.flag, { bottom: flagBottom, right: 24 }]}
        resizeMode="contain"
      />

      {/* CTA */}
      <View style={[styles.ctaWrap, { bottom: ctaBottom }]}>
        <GradientCtaButton
          label="To the GRID"
          enabled
          onPress={() => navigation.popToTop()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  topContent: {
    paddingLeft: 20,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  distanceNum: {
    fontFamily: 'Formula1-Black',
    fontSize: 100,
    lineHeight: 100,
    letterSpacing: 5,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  distanceUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    marginLeft: 8,
    marginBottom: 4,
    includeFontPadding: false,
  },
  message: {
    marginTop: 24,
    fontFamily: 'Formula1-Italic',
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.24,
    color: 'rgba(255,255,255,0.7)',
    includeFontPadding: false,
  },
  flag: {
    position: 'absolute',
    width: 206,
    height: 215,
  },
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
