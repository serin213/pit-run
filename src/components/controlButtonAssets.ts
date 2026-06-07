import type { ImageSourcePropType } from 'react-native';
import { PALETTE } from '../constants/colors';

export type ControlAction = 'pause' | 'play' | 'stop';

// 묶음 1b-LA: sector 색상 시스템 폐기, teamColor 9색 매핑으로 통일.
// RN require()는 정적 path만 받으므로 9색 × 3 action = 27개 자산을 미리 require하고
// lookup. 호출부는 hex teamColor 전달 → HEX_TO_NAME으로 name 매핑 → ASSETS lookup.
const ASSETS: Record<string, Record<ControlAction, ImageSourcePropType>> = {
  pink: {
    play: require('../../assets/control-buttons/play-pink.png'),
    pause: require('../../assets/control-buttons/pause-pink.png'),
    stop: require('../../assets/control-buttons/stop-pink.png'),
  },
  red: {
    play: require('../../assets/control-buttons/play-red.png'),
    pause: require('../../assets/control-buttons/pause-red.png'),
    stop: require('../../assets/control-buttons/stop-red.png'),
  },
  orange: {
    play: require('../../assets/control-buttons/play-orange.png'),
    pause: require('../../assets/control-buttons/pause-orange.png'),
    stop: require('../../assets/control-buttons/stop-orange.png'),
  },
  yellow: {
    play: require('../../assets/control-buttons/play-yellow.png'),
    pause: require('../../assets/control-buttons/pause-yellow.png'),
    stop: require('../../assets/control-buttons/stop-yellow.png'),
  },
  green: {
    play: require('../../assets/control-buttons/play-green.png'),
    pause: require('../../assets/control-buttons/pause-green.png'),
    stop: require('../../assets/control-buttons/stop-green.png'),
  },
  teal: {
    play: require('../../assets/control-buttons/play-teal.png'),
    pause: require('../../assets/control-buttons/pause-teal.png'),
    stop: require('../../assets/control-buttons/stop-teal.png'),
  },
  blue: {
    play: require('../../assets/control-buttons/play-blue.png'),
    pause: require('../../assets/control-buttons/pause-blue.png'),
    stop: require('../../assets/control-buttons/stop-blue.png'),
  },
  purple: {
    play: require('../../assets/control-buttons/play-purple.png'),
    pause: require('../../assets/control-buttons/pause-purple.png'),
    stop: require('../../assets/control-buttons/stop-purple.png'),
  },
  white: {
    play: require('../../assets/control-buttons/play-white.png'),
    pause: require('../../assets/control-buttons/pause-white.png'),
    stop: require('../../assets/control-buttons/stop-white.png'),
  },
};

// PALETTE hex → asset name 매핑. teamColor 매칭 실패 시 'yellow' 폴백.
// Swift teamColorName(_:)와 1:1 동일해야 — 동일 사용자 동일 색상.
const HEX_TO_NAME: Record<string, string> = {
  [PALETTE.pink.toUpperCase()]:   'pink',
  [PALETTE.red.toUpperCase()]:    'red',
  [PALETTE.orange.toUpperCase()]: 'orange',
  [PALETTE.yellow.toUpperCase()]: 'yellow',
  [PALETTE.green.toUpperCase()]:  'green',
  [PALETTE.teal.toUpperCase()]:   'teal',
  [PALETTE.blue.toUpperCase()]:   'blue',
  [PALETTE.purple.toUpperCase()]: 'purple',
  [PALETTE.white.toUpperCase()]:  'white',
};

export function getControlButtonImageSource(
  action: ControlAction,
  teamColor: string,
): ImageSourcePropType {
  const name = HEX_TO_NAME[teamColor.toUpperCase()] ?? 'red';
  return ASSETS[name][action];
}
