const { countTimingActivity, isoDateDaysAgo } = require('../../lib/timingActivityCounts');

describe('countTimingActivity', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('devuelve ceros sin vehículos', () => {
    expect(countTimingActivity([], { now })).toEqual({
      totalTimings: 0,
      timingsLast30Days: 0,
      windowDays: 30,
    });
  });

  it('cuenta totales y ventana de 30 días', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: '2026-09-01' },
          { timing_date: '2026-07-01' },
        ],
      },
      {
        vehicle_timings: [{ timing_date: '2026-09-14T18:00:00.000Z' }],
      },
    ];

    expect(countTimingActivity(vehicles, { now })).toEqual({
      totalTimings: 3,
      timingsLast30Days: 2,
      windowDays: 30,
    });
  });

  it('ignora fechas vacías en la ventana pero las cuenta en el total', () => {
    const vehicles = [{ vehicle_timings: [{ timing_date: null }, {}] }];
    expect(countTimingActivity(vehicles, { now })).toEqual({
      totalTimings: 2,
      timingsLast30Days: 0,
      windowDays: 30,
    });
  });
});

describe('isoDateDaysAgo', () => {
  it('resta días en UTC', () => {
    expect(isoDateDaysAgo(30, new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-08-16');
  });
});
