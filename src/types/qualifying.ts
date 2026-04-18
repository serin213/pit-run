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
  /** 퀄리파잉 완료 시각 (ms). 갱신 제안 카드 표시 기준 */
  qualifiedAt?: number;
};
