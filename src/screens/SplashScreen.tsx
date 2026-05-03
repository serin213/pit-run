import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { QualifyingGrade } from '../types';

// ─── Assets ──────────────────────────────────────────────────────────────────

const FLAG_PNG    = require('../../assets/race-flag.png');
const CONFETTI_PNG = require('../../assets/confetti.png');

const TROPHY_IMAGES: Record<QualifyingGrade, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/qualifying/trophy/f1-champion.png'),
  f1:          require('../../assets/qualifying/trophy/f1.png'),
  f1_rookie:   require('../../assets/qualifying/trophy/f1-rookie.png'),
  f2:          require('../../assets/qualifying/trophy/f2.png'),
  f3:          require('../../assets/qualifying/trophy/f3.png'),
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FLAG_SIZE   = 140;

const CONFETTI_W  = 204;
const CONFETTI_H  = 87;
const TROPHY_W    = 124;
const TROPHY_H    = 127;
const OVERLAP     = 43;
// confetti top=0, trophy top=(CONFETTI_H - OVERLAP)=44
const COMBINED_H  = CONFETTI_H + TROPHY_H - OVERLAP; // 171

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  grade: QualifyingGrade | null;
};

export default function SplashScreen({ grade }: Props) {
  const { height: windowH } = useWindowDimensions();
  const confettiOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!grade) return;
    Animated.timing(confettiOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [grade, confettiOpacity]);

  // 아랫 간격 = 윗 간격 + 40
  // topGap * 2 + imageH + 40 = windowH  →  topGap = (windowH - imageH - 40) / 2
  const imageH = grade ? COMBINED_H : FLAG_SIZE;
  const topGap = (windowH - imageH - 40) / 2;

  return (
    <View style={styles.container}>
      <View style={{ marginTop: topGap, alignItems: 'center' }}>
        {grade ? (
          // ── 등급 있는 유저: trophy + confetti ──
          <View style={{ width: CONFETTI_W, height: COMBINED_H }}>
            {/* Trophy (뒤) */}
            <Image
              source={TROPHY_IMAGES[grade]}
              style={{
                position: 'absolute',
                top: CONFETTI_H - OVERLAP,      // 44
                left: (CONFETTI_W - TROPHY_W) / 2, // 40
                width: TROPHY_W,
                height: TROPHY_H,
              }}
              resizeMode="contain"
            />
            {/* Confetti (앞, fade-in) */}
            <Animated.Image
              source={CONFETTI_PNG}
              style={{
                position: 'absolute',
                top: 0,
                width: CONFETTI_W,
                height: CONFETTI_H,
                opacity: confettiOpacity,
              }}
              resizeMode="contain"
            />
          </View>
        ) : (
          // ── 등급 없는 유저: flag ──
          <Image
            source={FLAG_PNG}
            style={{ width: FLAG_SIZE, height: FLAG_SIZE }}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },
});
