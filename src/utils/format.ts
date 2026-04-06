export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}'${sec < 10 ? '0' : ''}${sec}"`;
}

export function fmtPace(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}'${sec < 10 ? '0' : ''}${sec}"`;
}

export function fmtDist(km: number): string {
  return km.toFixed(2);
}

export function calcCalories(km: number, weightKg = 60): number {
  return Math.round(km * weightKg * 1.036);
}

export function generateComment(
  paceHistory: number[],
  avgPaceS: number,
  basePaceS: number,
): string {
  if (paceHistory.length < 2) return 'Race complete. Keep pushing!';

  const best = Math.min(...paceHistory);
  const worst = Math.max(...paceHistory);
  const consistency = Math.max(
    0,
    Math.min(100, Math.round(100 - ((worst - best) / avgPaceS) * 100)),
  );

  const mid = Math.ceil(paceHistory.length / 2);
  const avgFirst =
    paceHistory.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const avgSecond =
    paceHistory.slice(mid).reduce((a, b) => a + b, 0) /
    (paceHistory.length - mid);
  const negSplit = avgSecond < avgFirst;
  const delta = avgPaceS - basePaceS;

  if (consistency >= 90 && negSplit)
    return `Negative split with ${consistency}% consistency — textbook race management.`;
  if (consistency >= 90)
    return `Exceptional consistency at ${consistency}% — very controlled race pace.`;
  if (negSplit)
    return 'Strong negative split — you ran the second half faster. Energy well managed.';
  if (consistency >= 75)
    return 'Solid race. Minor pace variation suggests room for a stronger second half.';
  if (delta > 20)
    return `Pace was ${fmtPace(delta)} off target — hard tyre next race to build endurance.`;

  return `Race complete. Avg pace ${fmtPace(avgPaceS)}. Push for a negative split next time.`;
}
