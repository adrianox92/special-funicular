const { countTimingActivity, isoDateDaysAgo, QUIET_WINDOW_DAYS, STALE_WINDOW_DAYS } = require('../../lib/timingActivityCounts');

describe('countTimingActivity', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('devuelve ceros sin vehículos', () => {
    expect(countTimingActivity([], { now })).toEqual({
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      windowDays: STALE_WINDOW_DAYS,
      quietWindowDays: QUIET_WINDOW_DAYS,
    });
  });

  it('cuenta totales y ventanas de 30 y 14 días', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: '2026-08-25' },
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
      timingsLast14Days: 1,
      windowDays: STALE_WINDOW_DAYS,
      quietWindowDays: QUIET_WINDOW_DAYS,
    });
  });

  it('distingue 14 vs 30 días para el nudge suave', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: '2026-08-25' },
          { timing_date: '2026-09-10' },
        ],
      },
    ];

    expect(countTimingActivity(vehicles, { now })).toEqual({
      totalTimings: 2,
      timingsLast30Days: 2,
      timingsLast14Days: 1,
      windowDays: STALE_WINDOW_DAYS,
      quietWindowDays: QUIET_WINDOW_DAYS,
    });
  });

  it('ignora fechas vacías en la ventana pero las cuenta en el total', () => {
    const vehicles = [{ vehicle_timings: [{ timing_date: null }, {}] }];
    expect(countTimingActivity(vehicles, { now })).toEqual({
      totalTimings: 2,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      windowDays: STALE_WINDOW_DAYS,
      quietWindowDays: QUIET_WINDOW_DAYS,
    });
  });
});

describe('isoDateDaysAgo', () => {
  it('resta días en UTC', () => {
    expect(isoDateDaysAgo(30, new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-08-16');
    expect(isoDateDaysAgo(14, new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-09-01');
  });
});
