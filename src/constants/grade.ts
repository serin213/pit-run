import type { QualifyingGrade } from '../types';

export const GRADE_DISPLAY_NAME: Record<QualifyingGrade, string> = {
  f1_champion: 'F1 Champion',
  f1: 'F1',
  f1_rookie: 'F1 Rookie',
  f2: 'F2',
  f3: 'F3',
};

/** Uppercase labels used in UI callouts (e.g. "Get closer to F1 ROOKIE") */
export const GRADE_LABELS: Record<QualifyingGrade, string> = {
  f1_champion: 'F1 CHAMPION',
  f1: 'F1',
  f1_rookie: 'F1 ROOKIE',
  f2: 'F2',
  f3: 'F3',
};

export const GRADE_COLORS: Record<QualifyingGrade, string> = {
  f1_champion: '#E03A3E',
  f1: '#8528C5',
  f1_rookie: '#59B345',
  f2: '#FCB827',
  f3: '#FFFFFF',
};

/** Ordered from fastest to slowest */
export const GRADE_ORDER: QualifyingGrade[] = [
  'f1_champion',
  'f1',
  'f1_rookie',
  'f2',
  'f3',
];
