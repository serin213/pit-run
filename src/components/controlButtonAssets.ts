import type { SectorColor } from '../constants/colors';
import type { ImageSourcePropType } from 'react-native';

export type ControlAction = 'pause' | 'play' | 'stop';

const CONTROL_ICON_SOURCE: Record<ControlAction, Record<SectorColor, ImageSourcePropType>> = {
  pause: {
    yellow: require('../../assets/control-buttons/pause-yellow.png'),
    purple: require('../../assets/control-buttons/pause-purple.png'),
    green: require('../../assets/control-buttons/pause-green.png'),
  },
  play: {
    yellow: require('../../assets/control-buttons/play-yellow.png'),
    purple: require('../../assets/control-buttons/play-purple.png'),
    green: require('../../assets/control-buttons/play-green.png'),
  },
  stop: {
    yellow: require('../../assets/control-buttons/stop-yellow.png'),
    purple: require('../../assets/control-buttons/stop-purple.png'),
    green: require('../../assets/control-buttons/stop-green.png'),
  },
};

export function getControlButtonImageSource(
  action: ControlAction,
  sector: SectorColor,
): ImageSourcePropType {
  return CONTROL_ICON_SOURCE[action][sector];
}
