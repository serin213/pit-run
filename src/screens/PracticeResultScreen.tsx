import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PracticeResultScreenProps } from '../navigation/types';

/**
 * Practice 결과 화면 — 추후 본 결과 UI 구현 전 placeholder.
 */
export default function PracticeResultScreen({ navigation }: PracticeResultScreenProps) {
  return (
    <View style={st.container}>
      <Text style={st.title}>Practice complete</Text>
      <Pressable
        style={st.cta}
        onPress={() => navigation.popToTop()}
      >
        <Text style={st.ctaText}>DONE</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 40,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 28,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
  cta: {
    width: '100%',
    height: 58,
    backgroundColor: '#E03A3E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 18,
    letterSpacing: -0.36,
    includeFontPadding: false,
  },
});
