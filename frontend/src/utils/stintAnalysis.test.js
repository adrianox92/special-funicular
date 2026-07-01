import { analyzeStint, detectOutLap, computePaceDecay } from './stintAnalysis';

describe('stintAnalysis', () => {
  const mkLaps = (times) => times.map((t, i) => ({ lap_number: i + 1, lap_time_seconds: t }));

  it('detects improving trend', () => {
    const laps = mkLaps([12.5, 12.3, 12.2, 12.1, 12.0, 11.9]);
    const r = analyzeStint(laps);
    expect(r.trend).toBe('improving');
    expect(r.deltaFirstLast).toBeLessThan(0);
  });

  it('detects degrading trend', () => {
    const laps = mkLaps([12.0, 12.1, 12.2, 12.4, 12.6, 12.8]);
    const r = analyzeStint(laps);
    expect(r.trend).toBe('degrading');
    expect(r.deltaFirstLast).toBeGreaterThan(0);
  });

  it('handles short session', () => {
    const r = analyzeStint(mkLaps([12.0, 12.1]));
    expect(r.lapCount).toBe(2);
    expect(r.bestStreak).toBeNull();
  });

  it('finds best streak window', () => {
    const laps = mkLaps([12.5, 12.0, 11.9, 11.8, 12.2, 12.3]);
    const r = analyzeStint(laps, { streakK: 3 });
    expect(r.bestStreak).not.toBeNull();
    expect(r.bestStreak.average).toBeCloseTo(11.9, 1);
  });

  it('flags out-lap when first lap is slow', () => {
    const laps = mkLaps([14.0, 12.0, 12.1, 12.0, 12.2]);
    const flagged = detectOutLap(laps);
    expect(flagged[0].isOutLap).toBe(true);
    expect(flagged[1].isOutLap).toBe(false);
  });

  it('computePaceDecay returns rolling delta series', () => {
    const laps = mkLaps([12.0, 12.1, 12.0, 12.2, 12.1]);
    const series = computePaceDecay(laps, { window: 3 });
    expect(series.length).toBe(5);
    expect(series[2].deltaVsRollingAvg).not.toBeNull();
    expect(series[0].deltaVsRollingAvg).toBeNull();
  });
});
