const { parseGuidedSessionFromBody } = require('../../lib/guidedSessionParse');

describe('guidedSessionParse', () => {
  it('returns null when no guided fields', () => {
    const r = parseGuidedSessionFromBody({ vehicle_id: 'x' });
    expect(r.ok).toBe(true);
    expect(r.guidedSession).toBeNull();
  });

  it('parses guided_session object', () => {
    const r = parseGuidedSessionFromBody({
      guided_session: {
        baseline_lap_seconds: 12.345,
        target_improvement_ms: 200,
        laps_on_target: 8,
        total_laps: 15,
        best_improvement_ms: 350,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.guidedSession).toEqual({
      baseline_lap_seconds: 12.345,
      target_improvement_ms: 200,
      laps_on_target: 8,
      total_laps: 15,
      best_improvement_ms: 350,
    });
  });

  it('parses flat camelCase fields', () => {
    const r = parseGuidedSessionFromBody({
      baselineLapSeconds: 11.5,
      targetImprovementMs: 150,
      lapsOnTarget: 3,
      bestImprovementMs: 80,
    });
    expect(r.ok).toBe(true);
    expect(r.guidedSession.baseline_lap_seconds).toBe(11.5);
    expect(r.guidedSession.laps_on_target).toBe(3);
  });

  it('rejects invalid baseline', () => {
    const r = parseGuidedSessionFromBody({
      guided_session: { baseline_lap_seconds: -1, target_improvement_ms: 100, laps_on_target: 1 },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects laps_on_target > total_laps', () => {
    const r = parseGuidedSessionFromBody({
      guided_session: {
        baseline_lap_seconds: 12,
        target_improvement_ms: 100,
        laps_on_target: 10,
        total_laps: 5,
      },
    });
    expect(r.ok).toBe(false);
  });
});
