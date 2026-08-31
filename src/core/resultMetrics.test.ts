import { describe, expect, it } from 'vitest';
import { buildResultPaceMetrics, getPaceChartDomain } from './resultMetrics';

describe('buildResultPaceMetrics', () => {
  it('separates work laps from pit stops and uses distance-weighted averages', () => {
    const metrics = buildResultPaceMetrics(
      [
        { idx: 0, type: 'lap', distM: 400, durationSec: 120, paceS: 300 },
        { idx: 1, type: 'pit', distM: 100, durationSec: 60, paceS: null },
        { idx: 2, type: 'lap', distM: 600, durationSec: 210, paceS: 350 },
      ],
      [],
      360,
    );

    expect(metrics.workPaces).toEqual([300, 350]);
    expect(metrics.workAvgPaceS).toBe(330);
    expect(metrics.fastestPaceS).toBe(300);
    expect(metrics.pitStopPaceS).toBe(600);
  });

  it('hides pit-stop pace when there is no measurable pit distance', () => {
    const metrics = buildResultPaceMetrics(
      [
        { idx: 0, type: 'lap', distM: 400, durationSec: 120, paceS: 300 },
        { idx: 1, type: 'pit', distM: 0, durationSec: 60, paceS: null },
      ],
      [],
      360,
    );

    expect(metrics.pitStopPaceS).toBeNull();
  });

  it('uses legacy pace history when work lap logs are unavailable', () => {
    const metrics = buildResultPaceMetrics([], [320, 310, 315], 330);

    expect(metrics.workPaces).toEqual([320, 310, 315]);
    expect(metrics.workAvgPaceS).toBe(330);
    expect(metrics.fastestPaceS).toBe(310);
  });
});

describe('getPaceChartDomain', () => {
  it('uses the work-lap min and max as the visible pace range', () => {
    expect(getPaceChartDomain([320, 300, 340])).toEqual({
      minPace: 300,
      paceRange: 40,
    });
  });

  it('centers identical work laps instead of pinning them to the top', () => {
    expect(getPaceChartDomain([300, 300, 300])).toEqual({
      minPace: 295,
      paceRange: 10,
    });
  });
});
