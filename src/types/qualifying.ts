export type QualifyingGrade = 'A' | 'B' | 'C' | 'D';

export type QualifyingResult = {
  warmupMinutes: number;
  oneKmMs: number;
  paceSecPerKm: number;
  grade: QualifyingGrade;
  nextIntervalHint: string;
};
