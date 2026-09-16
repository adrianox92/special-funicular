import {
  MONTH_WINDOW_DAYS,
  bestLapSecondsFromTiming,
  buildSessionSummaryComparisons,
  deltaVsReference,
} from '../../utils/sessionSummaryComparisons';

const current = {
  id: 't-now',
  circuit_id: 'cir-1',
  circuit: 'Pista salón',
  lane: '1',
  best_lap_time: '00:11.324',
  best_lap_timestamp: 11.324,
  timing_date: '2026-09-16',
  session_type: 'TRAINING',
};

describe('sessionSummaryComparisons', () => {
  test('lee best_lap_timestamp o best_lap_time sin exigir lap_times', () => {
    expect(bestLapSecondsFromTiming({ best_lap_timestamp: 11.324 })).toBeCloseTo(11.324, 3);
    expect(bestLapSecondsFromTiming({ best_lap_time: '00:11.500' })).toBeCloseTo(11.5, 3);
    expect(bestLapSecondsFromTiming({})).toBeNull();
    expect(deltaVsReference(11.324, 11.5)).toBeCloseTo(-0.176, 3);
    expect(deltaVsReference(11.8, 11.5)).toBeCloseTo(0.3, 3);
  });

  test('sin historial y sin sync_meta: primera sesión (empty state de circuito)', () => {
    const result = buildSessionSummaryComparisons({ current, history: [] });
    expect(result.source).toBe('history');
    expect(result.hasCircuitHistory).toBe(false);
    expect(result.circuitPb).toBeNull();
    expect(result.monthPb).toBeNull();
    expect(result.previousSession).toBeNull();
    expect(result.isPersonalBest).toBe(true);
    expect(result.currentBestSeconds).toBeCloseTo(11.324, 3);
  });

  test('si el GET falla (history null) usa sync_meta del POST', () => {
    const result = buildSessionSummaryComparisons({
      current,
      history: null,
      syncMeta: {
        previous_best_lap_seconds: 11.5,
        is_personal_best: true,
        delta_vs_pb_seconds: -0.176,
      },
    });
    expect(result.source).toBe('sync_meta');
    expect(result.hasCircuitHistory).toBe(true);
    expect(result.circuitPb.seconds).toBe(11.5);
    expect(result.circuitPb.delta).toBeCloseTo(-0.176, 3);
    expect(result.circuitPb.isNewBest).toBe(true);
    expect(result.monthPb).toBeNull();
    expect(result.previousSession).toBeNull();
    expect(result.isPersonalBest).toBe(true);
  });

  test('PB de circuito, carril distinto, 30 días y sesión anterior', () => {
    const now = new Date('2026-09-16T15:00:00');
    const history = [
      current,
      {
        id: 't-old-circuit',
        circuit_id: 'cir-1',
        lane: '2',
        best_lap_time: '00:11.200',
        best_lap_timestamp: 11.2,
        timing_date: '2026-06-01',
        created_at: '2026-06-01T10:00:00.000Z',
        session_type: 'TRAINING',
      },
      {
        id: 't-lane',
        circuit_id: 'cir-1',
        lane: '1',
        best_lap_time: '00:11.480',
        best_lap_timestamp: 11.48,
        timing_date: '2026-09-01',
        created_at: '2026-09-01T10:00:00.000Z',
        session_type: 'TRAINING',
      },
      {
        id: 't-month',
        circuit_id: 'cir-1',
        lane: '2',
        best_lap_time: '00:11.400',
        best_lap_timestamp: 11.4,
        timing_date: '2026-09-10',
        created_at: '2026-09-10T10:00:00.000Z',
        session_type: 'TRAINING',
      },
      {
        id: 't-other-circuit',
        circuit_id: 'cir-other',
        lane: '1',
        best_lap_timestamp: 10.0,
        timing_date: '2026-09-15',
        session_type: 'TRAINING',
      },
    ];

    const result = buildSessionSummaryComparisons({ current, history, now });

    expect(result.source).toBe('history');
    expect(result.hasCircuitHistory).toBe(true);
    expect(result.circuitPb.seconds).toBeCloseTo(11.2, 3);
    expect(result.circuitPb.delta).toBeCloseTo(0.124, 3);
    expect(result.circuitPb.isNewBest).toBe(false);
    expect(result.isPersonalBest).toBe(false);

    expect(result.lanePb.seconds).toBeCloseTo(11.48, 3);
    expect(result.lanePb.delta).toBeCloseTo(-0.156, 3);
    expect(result.lanePb.isNewBest).toBe(true);

    expect(result.monthPb.seconds).toBeCloseTo(11.4, 3);
    expect(result.monthPb.delta).toBeCloseTo(-0.076, 3);
    expect(result.monthPb.isNewBest).toBe(true);

    expect(result.previousSession.seconds).toBeCloseTo(11.4, 3);
    expect(result.previousSession.timingDate).toBe('2026-09-10');
    expect(MONTH_WINDOW_DAYS).toBe(30);
  });

  test('no duplica el PB de carril si coincide con el de circuito', () => {
    const history = [
      {
        id: 't-same',
        circuit_id: 'cir-1',
        lane: '1',
        best_lap_timestamp: 11.5,
        timing_date: '2026-09-01',
        session_type: 'TRAINING',
      },
    ];
    const result = buildSessionSummaryComparisons({ current, history });
    expect(result.circuitPb.seconds).toBeCloseTo(11.5, 3);
    expect(result.lanePb).toBeNull();
  });

  test('excluye HEAT y la fila recién guardada; ignora circuitos distintos', () => {
    const history = [
      current,
      {
        id: 't-heat',
        circuit_id: 'cir-1',
        lane: '1',
        best_lap_timestamp: 10.5,
        timing_date: '2026-09-15',
        session_type: 'HEAT',
      },
      {
        id: 't-ok',
        circuit_id: 'cir-1',
        best_lap_time: '00:12.000',
        timing_date: '2026-09-14',
        created_at: '2026-09-14T08:00:00.000Z',
        session_type: 'TRAINING',
      },
    ];
    const result = buildSessionSummaryComparisons({ current, history });
    expect(result.circuitPb.seconds).toBeCloseTo(12, 3);
    expect(result.previousSession.seconds).toBeCloseTo(12, 3);
  });

  test('marca de más de 30 días no cuenta como PB del mes', () => {
    const now = new Date('2026-09-16T12:00:00');
    const history = [
      {
        id: 't-old',
        circuit_id: 'cir-1',
        best_lap_timestamp: 11.1,
        timing_date: '2026-08-16',
        created_at: '2026-08-16T12:00:00.000Z',
        session_type: 'TRAINING',
      },
    ];
    const result = buildSessionSummaryComparisons({ current, history, now });
    expect(result.circuitPb.seconds).toBeCloseTo(11.1, 3);
    expect(result.monthPb).toEqual({ empty: true });
    expect(result.previousSession.seconds).toBeCloseTo(11.1, 3);
  });

  test('expone consistency_score y peor vuelta si vienen en la respuesta de create', () => {
    const result = buildSessionSummaryComparisons({
      current: {
        ...current,
        consistency_score: 4.2,
        worst_lap_timestamp: 12.1,
      },
      history: [],
    });
    expect(result.consistencyScore).toBeCloseTo(4.2, 1);
    expect(result.worstLapSeconds).toBeCloseTo(12.1, 1);
  });

  test('funciona solo con best_lap_time (sin timestamp ni vueltas individuales)', () => {
    const result = buildSessionSummaryComparisons({
      current: {
        id: 't-now',
        circuit_id: 'cir-1',
        best_lap_time: '00:11.000',
      },
      history: [
        { id: 't-prev', circuit_id: 'cir-1', best_lap_time: '00:11.250', timing_date: '2026-09-10' },
      ],
      now: new Date('2026-09-16T12:00:00'),
    });
    expect(result.currentBestSeconds).toBeCloseTo(11, 3);
    expect(result.circuitPb.seconds).toBeCloseTo(11.25, 3);
    expect(result.circuitPb.delta).toBeCloseTo(-0.25, 3);
    expect(result.monthPb.seconds).toBeCloseTo(11.25, 3);
    expect(result.previousSession.delta).toBeCloseTo(-0.25, 3);
  });
});
