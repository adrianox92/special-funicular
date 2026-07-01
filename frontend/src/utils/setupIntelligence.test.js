import {
  computeComponentImpactRankings,
  detectStagnantConfigs,
  buildSetupSuggestions,
  computeSuggestedTrainingTarget,
} from './setupIntelligence';

describe('setupIntelligence v2', () => {
  const snapA = JSON.stringify([{ component_type: 'pinion', element: 'A', teeth: 10 }]);
  const snapB = JSON.stringify([{ component_type: 'pinion', element: 'B', teeth: 11 }]);

  const timings = [
    { timing_date: '2026-01-01', lane: '1', circuit_id: 'c1', setup_snapshot: snapA, best_lap_timestamp: 12.5 },
    { timing_date: '2026-01-05', lane: '1', circuit_id: 'c1', setup_snapshot: snapB, best_lap_timestamp: 12.4 },
    { timing_date: '2026-01-10', lane: '1', circuit_id: 'c1', setup_snapshot: snapA, best_lap_timestamp: 12.35 },
    { timing_date: '2026-01-15', lane: '1', circuit_id: 'c1', setup_snapshot: snapB, best_lap_timestamp: 12.3 },
  ];

  it('computeComponentImpactRankings accumulates transitions', () => {
    const rankings = computeComponentImpactRankings(timings, { minTransitions: 2 });
    expect(rankings.length).toBeGreaterThan(0);
    expect(rankings[0].component_type).toBe('pinion');
  });

  it('detectStagnantConfigs flags flat PB configs', () => {
    const groups = [
      {
        label: 'Config A',
        sessions: [
          { timing_date: '2026-01-01', best_lap_timestamp: 12.5 },
          { timing_date: '2026-02-15', best_lap_timestamp: 12.49 },
          { timing_date: '2026-03-01', best_lap_timestamp: 12.48 },
        ],
      },
    ];
    const stagnant = detectStagnantConfigs(groups, { minSessions: 3, minDays: 30, pbThreshold: 0.02 });
    expect(stagnant.length).toBe(1);
  });

  it('buildSetupSuggestions returns i18n keys', () => {
    const rankings = [{ component_type: 'pinion', avgDeltaSec: -0.08, count: 4 }];
    const stagnant = [{ label: 'Config X', sessionCount: 5, spanDays: 45 }];
    const s = buildSetupSuggestions(rankings, stagnant);
    expect(s.some((x) => x.type === 'component_positive')).toBe(true);
    expect(s.some((x) => x.key === 'analysis.suggestStagnant')).toBe(true);
  });

  it('computeSuggestedTrainingTarget tightens with high consistency', () => {
    const loose = computeSuggestedTrainingTarget({ best_lap_seconds: 12.0, consistency_score: 60 });
    const tight = computeSuggestedTrainingTarget({ best_lap_seconds: 12.0, consistency_score: 92 });
    expect(tight.deltaSeconds).toBeLessThan(loose.deltaSeconds);
  });
});
