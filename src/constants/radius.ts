export const radius = {
  sm: { borderRadius: 16, borderCurve: 'continuous' as const },
  md: { borderRadius: 20, borderCurve: 'continuous' as const },
  lg: { borderRadius: 24, borderCurve: 'continuous' as const },
};

/** CTA 버튼 전용 radius — Single SVG rx, Dual View borderRadius 모두 이 값 사용 */
export const CTA_RADIUS = radius.sm.borderRadius;
