import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import CircuitCard from '../components/CircuitCard';
import BackButton from '../components/BackButton';
import { CIRCUITS } from '../config/circuits';
import { CIRCUIT_CARD_CONFIG } from '../config/circuitCardConfig';
import { useAppStore } from '../store/appStore';
import type { AllCircuitsScreenProps } from '../navigation/types';

const H_PAD = 28;
const CARD_GAP = 12;

const SORTED_CIRCUITS = [...CIRCUITS].sort((a, b) => a.distanceKm - b.distanceKm);

export default function AllCircuitsScreen({ navigation, route }: AllCircuitsScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();
  const { setSelectedCircuitId } = useAppStore();

  // currentCircuitId passed from SetupScreen — null means no circuit was selected yet
  const currentCircuitId = route.params.currentCircuitId;

  const cardW = (windowW - H_PAD * 2 - CARD_GAP) / 2;

  const handleSelectCircuit = (id: string) => {
    setSelectedCircuitId(id);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      {/* Status bar blocker */}
      <View style={{ height: safeTop, backgroundColor: '#17171C' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>All Circuits</Text>

        <View style={styles.grid}>
          {SORTED_CIRCUITS.map((circuit) => {
            const cfg = CIRCUIT_CARD_CONFIG[circuit.id];
            if (!cfg) return null;
            const isSelected = circuit.id === currentCircuitId;
            const isDimmed = currentCircuitId !== null && !isSelected;
            return (
              <CircuitCard
                key={circuit.id}
                circuit={circuit}
                tag={cfg.tag}
                svgDisplayW={cfg.svgW}
                svgDisplayH={cfg.svgH}
                isSelected={isSelected}
                isDimmed={isDimmed}
                cardWidth={cardW}
                onPress={() => handleSelectCircuit(circuit.id)}
              />
            );
          })}
        </View>
      </ScrollView>
      {/* BackButton rendered last so it appears above scroll content */}
      <BackButton />
      {/* Safe-area blockers: inside the native screen view → reliably cover scroll content */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop + 63, backgroundColor: '#17171C', zIndex: 1000 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: safeBottom, backgroundColor: '#17171C', zIndex: 1000 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  scroll: {
    flex: 1,
  },
  content: {
    // paddingTop 63: BackButton bottom (safeTop+39) + 24 gap, scrollView starts at safeTop
    paddingTop: 63,
    paddingHorizontal: H_PAD,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    color: '#FFFFFF',
    letterSpacing: 1.8,
    includeFontPadding: false,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
