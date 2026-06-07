import type { ImageSourcePropType } from 'react-native';

export type ControlAction = 'pause' | 'play' | 'stop';

// 묶음 1b: sector 색상 시스템 제거 → 단일 yellow 아이콘 매핑.
// 아이콘 자체는 yellow 톤이지만 실제 RN <Image>는 tintColor를 받지 않고 PNG 그대로
// 표시되므로 호출부에서 색상은 별도로 처리(button bg/icon color). 시각 임팩트는
// 메인 distKm 숫자의 PALETTE.yellow 고정과 정합.
const CONTROL_ICON_SOURCE: Record<ControlAction, ImageSourcePropType> = {
  pause: require('../../assets/control-buttons/pause-yellow.png'),
  play: require('../../assets/control-buttons/play-yellow.png'),
  stop: require('../../assets/control-buttons/stop-yellow.png'),
};

export function getControlButtonImageSource(action: ControlAction): ImageSourcePropType {
  return CONTROL_ICON_SOURCE[action];
}
