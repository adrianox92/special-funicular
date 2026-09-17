const {
  countTimingActivity,
  countHobbyProgress,
  isoDateDaysAgo,
  QUIET_WINDOW_DAYS,
  STALE_WINDOW_DAYS,
} = require('../../lib/timingActivityCounts');

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

  it('cae a created_at si no hay timing_date (misma base que retención)', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: null, created_at: '2026-09-14T18:00:00.000Z' },
          { created_at: '2026-07-01T00:00:00.000Z' },
        ],
      },
    ];
    expect(countTimingActivity(vehicles, { now })).toEqual({
      totalTimings: 2,
      timingsLast30Days: 1,
      timingsLast14Days: 1,
      windowDays: STALE_WINDOW_DAYS,
      quietWindowDays: QUIET_WINDOW_DAYS,
    });
  });
});

describe('countHobbyProgress', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('devuelve ceros sin tiempos (usuario nuevo)', () => {
    expect(countHobbyProgress([], { now })).toEqual({
      sessionsThisMonth: 0,
      sessionsLastMonth: 0,
      lastSessionDate: null,
      daysSinceLastSession: null,
      consecutiveWeeksWithSession: 0,
    });
  });

  it('cuenta sesiones del mes UTC actual vs el anterior', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: '2026-09-08' },
          { timing_date: '2026-09-14' },
          { timing_date: '2026-08-20' },
          { timing_date: '2026-07-01' },
        ],
      },
    ];

    expect(countHobbyProgress(vehicles, { now })).toEqual({
      sessionsThisMonth: 2,
      sessionsLastMonth: 1,
      lastSessionDate: '2026-09-14',
      daysSinceLastSession: 1,
      consecutiveWeeksWithSession: 2,
    });
  });

  it('usa created_at si timing_date falta', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: null, created_at: '2026-09-10T08:00:00.000Z' },
          { created_at: '2026-08-05T10:00:00.000Z' },
        ],
      },
    ];

    const progress = countHobbyProgress(vehicles, { now });
    expect(progress.sessionsThisMonth).toBe(1);
    expect(progress.sessionsLastMonth).toBe(1);
    expect(progress.lastSessionDate).toBe('2026-09-10');
    expect(progress.daysSinceLastSession).toBe(5);
  });

  it('no usa created_at reciente si timing_date cae en otro mes', () => {
    const vehicles = [
      {
        vehicle_timings: [
          { timing_date: '2026-08-01', created_at: '2026-09-14T12:00:00.000Z' },
        ],
      },
    ];
    const progress = countHobbyProgress(vehicles, { now });
    expect(progress.sessionsThisMonth).toBe(0);
    expect(progress.sessionsLastMonth).toBe(1);
    expect(progress.lastSessionDate).toBe('2026-08-01');
  });
});

describe('isoDateDaysAgo', () => {
  it('resta días en UTC', () => {
    expect(isoDateDaysAgo(30, new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-08-16');
    expect(isoDateDaysAgo(14, new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-09-01');
  });
});
