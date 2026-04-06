import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import GradientCtaButton from '../components/GradientCtaButton';
import type { QualifyingPostScreenProps } from '../navigation/types';

const H_PAD = 28;

/**
 * 퀄리파잉 직후 임시 화면 — CTA로 Next race로 이동
 */
export default function QualifyingPostScreen({ navigation }: QualifyingPostScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const ctaW = windowW - H_PAD * 2;

  return (
    <View style={styles.root}>
      <View style={{ height: safeTop, backgroundColor: '#17171C' }} />
      <View style={[styles.body, { paddingHorizontal: H_PAD, paddingTop: 80 }]}>
        <Text style={styles.title} allowFontScaling={false}>
          Qualifying complete
        </Text>
        <Text style={styles.sub} allowFontScaling={false}>
          Your 1km result is saved. Continue to see your next race pick.
        </Text>
      </View>
      <View style={[styles.ctaWrap, { paddingHorizontal: H_PAD, bottom: 40 }]}>
        <GradientCtaButton
          width={ctaW}
          height={58}
          label="CONTINUE"
          enabled
          onPress={() => navigation.replace('NextRace')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 28,
    lineHeight: 34,
    color: '#FFFFFF',
    letterSpacing: 1.4,
    includeFontPadding: false,
    marginBottom: 16,
  },
  sub: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.34,
    includeFontPadding: false,
  },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
