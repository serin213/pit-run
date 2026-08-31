import type { LapEntry } from '../types/run';

export type ResultPaceMetrics = {
  workPaces: number[];
  workAvgPaceS: number;
  fastestPaceS: number;
  pitStopPaceS: number | null;
};

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function paceFromEntry(entry: LapEntry): number | null {
  if (!isPositiveFinite(entry.distM) || !isPositiveFinite(entry.durationSec)) return null;
  return entry.durationSec / (entry.distM / 1000);
}

function weightedPace(entries: LapEntry[]): number | null {
  const totals = entries.reduce(
    (acc, entry) => {
      if (!isPositiveFinite(entry.distM) || !isPositiveFinite(entry.durationSec)) return acc;
      acc.distM += entry.distM;
      acc.durationSec += entry.durationSec;
      return acc;
    },
    { distM: 0, durationSec: 0 },
  );

  if (totals.distM <= 0 || totals.durationSec <= 0) return null;
  return totals.durationSec / (totals.distM / 1000);
}

export function buildResultPaceMetrics(
  lapLog: LapEntry[],
  fallbackPaces: number[],
  totalPaceS: number,
): ResultPaceMetrics {
  const workEntries = lapLog.filter((entry) => entry.type === 'lap');
  const pitEntries = lapLog.filter((entry) => entry.type === 'pit');
  const workPaces = workEntries
    .map(paceFromEntry)
    .filter((pace): pace is number => pace != null);

  const validFallbackPaces = fallbackPaces.filter(isPositiveFinite);
  const fallbackPace = isPositiveFinite(totalPaceS) ? totalPaceS : 300;
  const displayedWorkPaces = workPaces.length > 0
    ? workPaces
    : validFallbackPaces.length > 0
      ? validFallbackPaces
      : [fallbackPace];

  const workAvgPaceS = weightedPace(workEntries) ?? fallbackPace;

  return {
    workPaces: displayedWorkPaces,
    workAvgPaceS,
    fastestPaceS: Math.min(...displayedWorkPaces),
    pitStopPaceS: weightedPace(pitEntries),
  };
}

export function getPaceChartDomain(paces: number[]): { minPace: number; paceRange: number } {
  const validPaces = paces.filter(isPositiveFinite);
  if (validPaces.length === 0) return { minPace: 295, paceRange: 10 };

  const minPace = Math.min(...validPaces);
  const maxPace = Math.max(...validPaces);
  const span = maxPace - minPace;

  if (span === 0) {
    return { minPace: minPace - 5, paceRange: 10 };
  }

  return { minPace, paceRange: span };
}
