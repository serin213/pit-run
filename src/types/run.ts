/** 랩 로그 엔트리 — runStore와 ResultScreen이 공유 */
export interface LapEntry {
  idx: number;
  type: 'lap' | 'pit';
  distM: number;
  durationSec: number;
  paceS: number | null;
}
