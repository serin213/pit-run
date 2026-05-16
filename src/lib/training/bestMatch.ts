import type { CircuitDefinition } from '../../config/circuits';
import type { CircuitTagType } from '../../components/CircuitCard';
import type { TireType } from '../../constants/colors';

/**
 * 타이어 → 선호 서킷 태그 우선순위.
 * soft (짧고 강한 페이스): Sprint > Mixed
 * medium (균형): Mixed > Tempo
 * hard (긴 거리 일관 페이스): Tempo > Mixed
 * wet (조심스러운 짧은 거리): Sprint
 */
const TIRE_TAG_PREFERENCE: Record<TireType, CircuitTagType[]> = {
  soft:   ['Sprint', 'Mixed'],
  medium: ['Mixed', 'Tempo'],
  hard:   ['Tempo', 'Mixed'],
  wet:    ['Sprint'],
};

/**
 * 선택한 타이어에 맞는 서킷을 count개 반환.
 * 타이어 null이면 디자인 기본값 (Monaco + Albert Park, 없으면 첫 N개).
 */
export function pickBestMatch(
  tire: TireType | null,
  allCircuits: CircuitDefinition[],
  circuitConfig: Record<string, { tag: CircuitTagType }>,
  count: number = 2,
): CircuitDefinition[] {
  if (!tire) {
    const monaco = allCircuits.find((c) => c.id === 'monaco');
    const albert = allCircuits.find((c) => c.id === 'albert-park');
    if (monaco && albert) return [monaco, albert].slice(0, count);
    return allCircuits.slice(0, count);
  }

  const preferredTags = TIRE_TAG_PREFERENCE[tire];
  const picked: CircuitDefinition[] = [];
  const seenIds = new Set<string>();

  // 선호 태그 순서대로 매칭, 동일 태그 내에서는 거리 짧은 순
  for (const tag of preferredTags) {
    const matches = allCircuits
      .filter((c) => circuitConfig[c.id]?.tag === tag && !seenIds.has(c.id))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    for (const c of matches) {
      if (picked.length >= count) break;
      picked.push(c);
      seenIds.add(c.id);
    }
    if (picked.length >= count) break;
  }

  // 부족하면 나머지 중 거리 짧은 순으로 채움
  if (picked.length < count) {
    const fallback = allCircuits
      .filter((c) => !seenIds.has(c.id))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    for (const c of fallback) {
      if (picked.length >= count) break;
      picked.push(c);
    }
  }

  return picked;
}
