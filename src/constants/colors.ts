export const PALETTE = {
  pink:   '#E03A8A',
  red:    '#E03A3E',
  orange: '#FF8716',
  yellow: '#FCB827',
  green:  '#59B345',
  teal:   '#04CBBA',
  blue:   '#3F5CFF',
  purple: '#8528C5',
  grey:   '#8A8A8D',
  white:  '#FFFFFF',
} as const;

/** Preview/placeholder accent fallback (when user hasn't picked a team color). */
export const PREVIEW_DEFAULT_COLOR = '#7C7C88';

export const COLORS = {
  bg: '#17171C',
  // 잔재 정리: COLORS.sector 객체 제거 — 묶음 1a (gradient 폐기) + 1b (sector 시스템
  // 제거) 이후 dead code. grep으로 호출처 0건 확인.
  tire: {
    soft:   PALETTE.red,
    medium: PALETTE.yellow,
    hard:   PALETTE.white,
    wet:    '#4CB5C9',
  },
  text: {
    primary:   PALETTE.white,
    secondary: 'rgba(255,255,255,0.5)',
    dim:       'rgba(255,255,255,0.3)',
  },
  boxbox: {
    sheet:   '#202028',
    button:  '#34343F',
    overlay: 'rgba(0,0,0,0.75)',
  },
} as const;

// 묶음 1b: SectorColor 타입 제거. teamColor로 통일. COLORS.sector dead 객체는
// 잔재 정리에서 제거됨.
export type TireType = keyof typeof COLORS.tire;
