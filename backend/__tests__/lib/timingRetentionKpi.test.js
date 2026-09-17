const {
  WINDOW_DAYS,
  PAGE_SIZE,
  TIMING_RETENTION_GOAL,
  roundPct,
  timingEffectiveAt,
  isTimingInLastDays,
  computeTimingRetentionKpi,
  countRegisteredUsers,
  fetchTimingRetentionKpi,
} = require('../../lib/timingRetentionKpi');

const NOW = new Date('2026-09-17T10:00:00.000Z');
const DAYS = (n) => n * 24 * 60 * 60 * 1000;

describe('roundPct', () => {
  it('redondea a 1 decimal como la rutina semanal (2.7%)', () => {
    expect(roundPct(2, 74)).toBe(2.7);
    expect(roundPct(3, 91)).toBe(3.3);
  });

  it('devuelve 0 si no hay registrados', () => {
    expect(roundPct(1, 0)).toBe(0);
    expect(roundPct(1, null)).toBe(0);
  });
});

describe('timingEffectiveAt / isTimingInLastDays', () => {
  it('usa timing_date::timestamptz y no created_at cuando hay fecha', () => {
    const timing = {
      timing_date: '2026-08-01',
      created_at: '2026-09-16T12:00:00.000Z',
    };
    expect(timingEffectiveAt(timing).toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(isTimingInLastDays(timing, NOW, WINDOW_DAYS)).toBe(false);
  });

  it('cae a created_at si timing_date es null (coalesce)', () => {
    const timing = { timing_date: null, created_at: '2026-09-10T08:00:00.000Z' };
    expect(isTimingInLastDays(timing, NOW, WINDOW_DAYS)).toBe(true);
  });

  it('incluye el borde de la ventana de 30 días', () => {
    const atCutoff = { created_at: new Date(NOW.getTime() - DAYS(30)).toISOString() };
    const justBefore = { created_at: new Date(NOW.getTime() - DAYS(30) - 1000).toISOString() };
    expect(isTimingInLastDays(atCutoff, NOW, 30)).toBe(true);
    expect(isTimingInLastDays(justBefore, NOW, 30)).toBe(false);
  });

  it('cuenta timing_date reciente aunque created_at sea antiguo', () => {
    const timing = {
      timing_date: '2026-09-16',
      created_at: '2025-01-01T00:00:00.000Z',
    };
    expect(isTimingInLastDays(timing, NOW, WINDOW_DAYS)).toBe(true);
  });
});

describe('computeTimingRetentionKpi', () => {
  const vehicles = [
    { id: 'v-a', user_id: 'u-active' },
    { id: 'v-b', user_id: 'u-old' },
    { id: 'v-c', user_id: 'u-garage' },
    { id: 'v-d', user_id: 'u-active' },
  ];

  const timings = [
    {
      vehicle_id: 'v-a',
      timing_date: '2026-09-10',
      created_at: '2026-09-10T11:00:00.000Z',
    },
    {
      vehicle_id: 'v-d',
      timing_date: '2026-09-15',
      created_at: '2026-09-15T11:00:00.000Z',
    },
    {
      vehicle_id: 'v-b',
      timing_date: '2026-01-01',
      created_at: '2026-01-01T11:00:00.000Z',
    },
    {
      vehicle_id: 'missing',
      timing_date: '2026-09-16',
      created_at: '2026-09-16T11:00:00.000Z',
    },
  ];

  it('calcula conteos y % sobre usuarios registrados (join timings→vehicles)', () => {
    const kpi = computeTimingRetentionKpi({
      registeredUsers: 100,
      vehicles,
      timings,
      now: NOW,
    });

    expect(kpi.window_days).toBe(30);
    expect(kpi.registered_users).toBe(100);
    expect(kpi.users_with_vehicle).toBe(3);
    expect(kpi.users_with_timing_ever).toBe(2);
    expect(kpi.users_with_timing_30d).toBe(1);
    expect(kpi.timing_30d_pct).toBe(1);
    expect(kpi.users_with_vehicle_pct).toBe(3);
    expect(kpi.users_with_timing_ever_pct).toBe(2);
    expect(kpi.goal).toEqual(TIMING_RETENTION_GOAL);
    expect(kpi.window_start).toBe(new Date(NOW.getTime() - DAYS(30)).toISOString());
  });

  it('no cuenta dos veces al mismo usuario con varios timings 30d', () => {
    const kpi = computeTimingRetentionKpi({
      registeredUsers: 10,
      vehicles,
      timings,
      now: NOW,
    });
    expect(kpi.users_with_timing_30d).toBe(1);
  });

  it('no usa created_at reciente si timing_date cae fuera de 30d (coalesce)', () => {
    const kpi = computeTimingRetentionKpi({
      registeredUsers: 10,
      vehicles: [{ id: 'v-1', user_id: 'u-1' }],
      timings: [
        {
          vehicle_id: 'v-1',
          timing_date: '2026-01-01',
          created_at: '2026-09-16T00:00:00.000Z',
        },
      ],
      now: NOW,
    });
    expect(kpi.users_with_timing_ever).toBe(1);
    expect(kpi.users_with_timing_30d).toBe(0);
    expect(kpi.timing_30d_pct).toBe(0);
  });
});

function createPagedBuilder(pages) {
  let call = 0;
  const builder = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    then(onFulfilled, onRejected) {
      const data = pages[call] ?? [];
      call += 1;
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };
  return { builder, getCallCount: () => call };
}

describe('countRegisteredUsers', () => {
  it('cuenta los usuarios de auth.admin.listUsers', async () => {
    const listUsers = jest.fn().mockResolvedValueOnce({
      data: { users: [{ id: 'a' }, { id: 'b' }] },
      error: null,
    });
    const n = await countRegisteredUsers({ auth: { admin: { listUsers } } });
    expect(n).toBe(2);
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: PAGE_SIZE });
  });

  it('pagina cuando hay una página llena', async () => {
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `u-${i}` }));
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce({ data: { users: page1 }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: 'last' }] }, error: null });
    const n = await countRegisteredUsers({ auth: { admin: { listUsers } } });
    expect(n).toBe(PAGE_SIZE + 1);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });
});

describe('fetchTimingRetentionKpi', () => {
  it('consulta auth.users, vehicles y vehicle_timings y compone el KPI', async () => {
    const vehiclesBuilder = createPagedBuilder([
      [{ id: 'v-1', user_id: 'u-1' }],
    ]);
    const timingsBuilder = createPagedBuilder([
      [
        {
          vehicle_id: 'v-1',
          timing_date: '2026-09-16',
          created_at: '2026-09-16T00:00:00.000Z',
        },
      ],
    ]);
    const from = jest.fn((table) => {
      if (table === 'vehicles') return vehiclesBuilder.builder;
      if (table === 'vehicle_timings') return timingsBuilder.builder;
      throw new Error(`tabla inesperada ${table}`);
    });
    const listUsers = jest.fn().mockResolvedValue({
      data: {
        users: Array.from({ length: 30 }, (_, i) => ({ id: `u-${i}` })),
        total: 30,
      },
      error: null,
    });

    const kpi = await fetchTimingRetentionKpi(
      { from, auth: { admin: { listUsers } } },
      { now: NOW },
    );

    expect(from).toHaveBeenCalledWith('vehicles');
    expect(from).toHaveBeenCalledWith('vehicle_timings');
    expect(kpi.registered_users).toBe(30);
    expect(kpi.users_with_vehicle).toBe(1);
    expect(kpi.users_with_timing_30d).toBe(1);
    expect(kpi.timing_30d_pct).toBe(3.3);
  });
});
