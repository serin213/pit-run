export type QualifyingGrade =
  | 'f1_champion'
  | 'f1'
  | 'f1_rookie'
  | 'f2'
  | 'f3';

export type QualifyingResult = {
  warmupMinutes: number;
  oneKmMs: number;
  paceSecPerKm: number;
  grade: QualifyingGrade;
  nextIntervalHint: string;
};
