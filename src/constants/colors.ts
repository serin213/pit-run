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
  sector: {
    yellow: { start: PALETTE.yellow, end: '#FC8A27', glow: 'rgba(252,184,39,0.62)' },
    purple: { start: PALETTE.purple, end: '#B328C5', glow: 'rgba(190,78,255,0.62)' },
    green:  { start: PALETTE.green,  end: '#28C584', glow: 'rgba(89,179,69,0.62)'  },
  },
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

export type SectorColor = keyof typeof COLORS.sector;
export type TireType = keyof typeof COLORS.tire;
