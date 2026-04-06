import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeTop } from '../hooks/useSafeTop';
import Svg, { Path } from 'react-native-svg';

type Props = {
  onPress?: () => void;
};

export default function BackButton({ onPress }: Props) {
  const navigation = useNavigation();
  const safeTop = useSafeTop();
  const top = safeTop + 14;

  const handlePress = onPress ?? (() => navigation.goBack());

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={16}
      style={[styles.btn, { top }]}
    >
      <Svg width={10} height={17} viewBox="0 0 10 17" fill="none">
        <Path
          d="M9 1L2 8.5L9 16"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: 28,
    zIndex: 1001,
    padding: 4,
  },
});
