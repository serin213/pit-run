import type { CircuitTagType } from '../components/CircuitCard';

export type CircuitCardConfig = {
  tag: CircuitTagType;
  svgX: number;
  svgY: number;
  svgW: number;
  svgH: number;
  /** Best Match 넓은 카드용 트랙 박스(px). 모나코처럼 그리드(167)와 동일 픽셀을 쓰면 체감 크기가 맞음 */
  featured?: { svgW: number; svgH: number };
};

// SVG position/size config inside each card (167×182 card, from Figma node 689-14201)
export const CIRCUIT_CARD_CONFIG: Record<string, CircuitCardConfig> = {
  'monaco': {
    tag: 'Sprint',
    svgX: 50,
    svgY: 124,
    svgW: 99,
    svgH: 40,
    featured: { svgW: 99, svgH: 40 },
  },
  'hungaroring': {
    tag: 'Sprint',
    svgX: 89,
    svgY: 107,
    svgW: 60,
    svgH: 57,
    featured: { svgW: 60, svgH: 57 },
  },
  'marina-bay': {
    tag: 'Sprint',
    svgX: 67,
    svgY: 113,
    svgW: 82,
    svgH: 51,
    featured: { svgW: 82, svgH: 51 },
  },
  'albert-park': {
    tag: 'Mixed',
    svgX: 64,
    svgY: 122,
    svgW: 85,
    svgH: 42,
    featured: { svgW: 85, svgH: 42 },
  },
  'shanghai': {
    tag: 'Mixed',
    svgX: 68,
    svgY: 112,
    svgW: 81,
    svgH: 52,
    featured: { svgW: 81, svgH: 52 },
  },
  'monza': {
    tag: 'Tempo',
    svgX: 62,
    svgY: 121,
    svgW: 87,
    svgH: 43,
    featured: { svgW: 87, svgH: 43 },
  },
  'silverstone': {
    tag: 'Mixed',
    svgX: 67,
    svgY: 116,
    svgW: 82,
    svgH: 48,
    featured: { svgW: 82, svgH: 48 },
  },
  'baku': {
    tag: 'Tempo',
    svgX: 61,
    svgY: 115,
    svgW: 88,
    svgH: 49,
    featured: { svgW: 88, svgH: 49 },
  },
  'las-vegas': {
    tag: 'Tempo',
    svgX: 72,
    svgY: 120,
    svgW: 79,
    svgH: 44,
    featured: { svgW: 79, svgH: 44 },
  },
  'spa': {
    tag: 'Mixed',
    svgX: 70,
    svgY: 114,
    svgW: 79,
    svgH: 50,
    featured: { svgW: 79, svgH: 50 },
  },
  'suzuka': {
    tag: 'Sprint',
    svgX: 65,
    svgY: 115,
    svgW: 80,
    svgH: 50,
    featured: { svgW: 80, svgH: 50 },
  },
};
