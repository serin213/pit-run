import React from 'react';
import { View } from 'react-native';
import { COLORS } from '../constants/colors';

type Props = {
  safeTop: number;
};

export default function TopSafeSpacer({ safeTop }: Props) {
  return <View style={{ height: safeTop, backgroundColor: COLORS.bg }} />;
}
