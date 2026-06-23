const {
  filterTimingsForBaseline,
  sortTimingsByBestLap,
  resolveBaselineTimings,
} = require('../../lib/syncTimingsQuery');

describe('syncTimingsQuery', () => {
  const sampleTimings = [
    {
      id: '1',
      vehicle_id: 'v1',
      circuit_id: 'c1',
      circuit: 'Pista A',
      lane: '1',
      best_lap_timestamp: 8.5,
      best_lap_time: '00:08.500',
    },
    {
      id: '2',
      vehicle_id: 'v1',
      circuit_id: null,
      circuit: 'Pista A',
      lane: '1',
      best_lap_timestamp: 9.1,
      best_lap_time: '00:09.100',
    },
    {
      id: '3',
      vehicle_id: 'v1',
      circuit_id: 'c1',
      circuit: 'Pista A',
      lane: '2',
      best_lap_timestamp: 7.9,
      best_lap_time: '00:07.900',
    },
    {
      id: '4',
      vehicle_id: 'v1',
      circuit_id: 'c2',
      circuit: 'Pista B',
      lane: '1',
      best_lap_timestamp: 10.0,
      best_lap_time: '00:10.000',
    },
  ];

  test('filterTimingsForBaseline matches circuit_id and lane', () => {
    const filtered = filterTimingsForBaseline(sampleTimings, {
      circuit_id: 'c1',
      circuitName: 'Pista A',
      lane: '1',
    });
    expect(filtered.map((t) => t.id)).toEqual(['1', '2']);
  });

  test('filterTimingsForBaseline matches legacy circuit name without circuit_id', () => {
    const filtered = filterTimingsForBaseline(sampleTimings, {
      circuit_id: 'c1',
      circuitName: 'Pista A',
      lane: '1',
    });
    expect(filtered.some((t) => t.id === '2')).toBe(true);
  });

  test('filterTimingsForBaseline excludes other lanes', () => {
    const filtered = filterTimingsForBaseline(sampleTimings, {
      circuit_id: 'c1',
      circuitName: 'Pista A',
      lane: '2',
    });
    expect(filtered.map((t) => t.id)).toEqual(['3']);
  });

  test('sortTimingsByBestLap orders by best lap ascending', () => {
    const sorted = sortTimingsByBestLap(sampleTimings);
    expect(sorted.map((t) => t.id)).toEqual(['3', '1', '2', '4']);
  });

  test('resolveBaselineTimings falls back when lane does not match', () => {
    const legacyNoLane = [
      {
        id: '5',
        vehicle_id: 'v1',
        circuit_id: 'c1',
        circuit: 'Pista A',
        lane: null,
        best_lap_timestamp: 8.2,
        best_lap_time: '00:08.200',
      },
    ];
    const { timings, laneFallback } = resolveBaselineTimings(legacyNoLane, {
      circuit_id: 'c1',
      circuitName: 'Pista A',
      lane: '1',
    });
    expect(laneFallback).toBe(true);
    expect(timings.map((t) => t.id)).toEqual(['5']);
  });
});
