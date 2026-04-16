import type { QualifyingGrade } from '../types';

export const GRADE_DISPLAY_NAME: Record<QualifyingGrade, string> = {
  f1_champion: 'F1 Champion',
  f1: 'F1',
  f1_rookie: 'F1 Rookie',
  f2: 'F2',
  f3: 'F3',
};

/** Ordered from fastest to slowest */
export const GRADE_ORDER: QualifyingGrade[] = [
  'f1_champion',
  'f1',
  'f1_rookie',
  'f2',
  'f3',
];
