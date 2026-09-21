jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

jest.mock('../../lib/supabaseClients', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    getAnonClient: jest.fn(() => mockSupabase),
    getServiceClient: jest.fn(() => mockSupabase),
    getServiceOrAnonClient: jest.fn(() => mockSupabase),
    createUserScopedClient: jest.fn(() => mockSupabase),
    createServerClient: jest.fn(() => mockSupabase),
  };
});

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');
const { createUserScopedClient } = require('../../lib/supabaseClients');

const USER_ID = 'test-user-id';
const AUTH = { Authorization: 'Bearer test-token' };

function createQueryBuilder({ data = [], count = 0, error = null } = {}) {
  const calls = {
    select: [],
    eq: [],
    ilike: [],
    or: [],
    order: [],
    range: [],
    in: [],
  };
  const builder = {
    calls,
    select: jest.fn((...args) => {
      calls.select.push(args);
      return builder;
    }),
    eq: jest.fn((col, val) => {
      calls.eq.push([col, val]);
      return builder;
    }),
    ilike: jest.fn((col, val) => {
      calls.ilike.push([col, val]);
      return builder;
    }),
    or: jest.fn((expr) => {
      calls.or.push(expr);
      return builder;
    }),
    order: jest.fn((col, opts) => {
      calls.order.push([col, opts]);
      return builder;
    }),
    range: jest.fn((from, to) => {
      calls.range.push([from, to]);
      return builder;
    }),
    in: jest.fn((col, vals) => {
      calls.in.push([col, vals]);
      return builder;
    }),
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data, error, count }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function filterFingerprint(builder) {
  return {
    eq: builder.calls.eq.filter(([col]) => col !== 'user_id'),
    ilike: [...builder.calls.ilike],
    or: [...builder.calls.or],
  };
}

function mockVehiclesFrom({ count = 0, data = [] } = {}) {
  const vehicleBuilders = [];
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'vehicles') {
      const b = createQueryBuilder({ data, count, error: null });
      vehicleBuilders.push(b);
      return b;
    }
    return createQueryBuilder({ data: [], count: 0, error: null });
  });
  return vehicleBuilders;
}

describe('GET /api/vehicles — filtros en servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('sin filtros: count y página sin predicados extra; usa cliente JWT', async () => {
    const builders = mockVehiclesFrom({ count: 40, data: [] });

    const response = await request(app).get('/api/vehicles?page=1&limit=25').set(AUTH);

    expect(response.status).toBe(200);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(builders).toHaveLength(2);

    const [countBuilder, listBuilder] = builders;
    expect(countBuilder.calls.eq).toEqual([['user_id', USER_ID]]);
    expect(countBuilder.calls.ilike).toEqual([]);
    expect(countBuilder.calls.or).toEqual([]);
    expect(countBuilder.calls.range).toEqual([]);

    expect(listBuilder.calls.eq).toEqual([['user_id', USER_ID]]);
    expect(listBuilder.calls.ilike).toEqual([]);
    expect(listBuilder.calls.or).toEqual([]);
    expect(listBuilder.calls.range).toEqual([[0, 24]]);

    expect(response.body.pagination).toEqual({
      total: 40,
      page: 1,
      limit: 25,
      totalPages: 2,
    });
    expect(response.body.vehicles).toEqual([]);
  });

  test('un solo filtro (manufacturer) se aplica a count y a la página', async () => {
    const builders = mockVehiclesFrom({ count: 3, data: [] });

    const response = await request(app)
      .get('/api/vehicles?page=1&limit=10&manufacturer=Ninco')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.eq).toEqual([['user_id', USER_ID]]);
      expect(b.calls.ilike).toEqual([]);
      expect(b.calls.or).toEqual(['manufacturer.ilike."%Ninco%"']);
    }
    expect(listBuilder.calls.range).toEqual([[0, 9]]);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.pagination.totalPages).toBe(1);
  });

  test('manufacturer con punto (Slot.it) cita el patrón ilike en count y página', async () => {
    const builders = mockVehiclesFrom({ count: 2, data: [] });

    const response = await request(app)
      .get('/api/vehicles?page=1&limit=10&manufacturer=Slot.it')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    for (const b of builders) {
      expect(b.calls.ilike).toEqual([]);
      expect(b.calls.or).toEqual(['manufacturer.ilike."%Slot.it%"']);
    }
  });

  test('varios filtros + página 2: range sobre el conjunto filtrado y OR museo/taller', async () => {
    const builders = mockVehiclesFrom({ count: 23, data: [] });

    const response = await request(app)
      .get(
        '/api/vehicles?page=2&limit=10&manufacturer=Ninco&type=GT&modified=Sí&filterMuseo=true&filterTaller=true',
      )
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.eq).toEqual([
        ['user_id', USER_ID],
        ['type', 'GT'],
        ['modified', true],
      ]);
      expect(b.calls.ilike).toEqual([]);
      expect(b.calls.or).toEqual([
        'manufacturer.ilike."%Ninco%"',
        'museo.eq.true,taller.eq.true',
      ]);
    }

    expect(listBuilder.calls.range).toEqual([[10, 19]]);
    expect(countBuilder.calls.range).toEqual([]);
    expect(response.body.pagination).toEqual({
      total: 23,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  test('el total paginado coincide con el count filtrado (mismos predicados)', async () => {
    const FILTERED_COUNT = 17;
    const builders = mockVehiclesFrom({ count: FILTERED_COUNT, data: [] });

    const response = await request(app)
      .get('/api/vehicles?page=1&limit=5&model=Ferrari&digital=Digital&scale=32')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    expect(filterFingerprint(countBuilder)).toEqual(filterFingerprint(listBuilder));
    expect(filterFingerprint(countBuilder)).toEqual({
      eq: [
        ['digital', true],
        ['scale_factor', 32],
      ],
      ilike: [],
      or: ['model.ilike."%Ferrari%"'],
    });

    expect(response.body.pagination.total).toBe(FILTERED_COUNT);
    expect(response.body.pagination.totalPages).toBe(4);
    expect(listBuilder.calls.range).toEqual([[0, 4]]);
  });
});
