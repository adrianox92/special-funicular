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
    not: [],
    order: [],
    range: [],
    in: [],
    gt: [],
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
    not: jest.fn((col, op, val) => {
      calls.not.push([col, op, val]);
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
    gt: jest.fn((col, val) => {
      calls.gt.push([col, val]);
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
    or: [...builder.calls.or],
    not: [...builder.calls.not],
    gt: [...builder.calls.gt],
  };
}

function mockFrom({ table, count = 0, data = [] } = {}) {
  const builders = [];
  mockSupabase.from.mockImplementation((name) => {
    if (name === table) {
      const b = createQueryBuilder({ data, count, error: null });
      builders.push(b);
      return b;
    }
    return createQueryBuilder({ data: [], count: 0, error: null });
  });
  return builders;
}

describe('GET /api/inventory — filtros y paginación en servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('sin page/limit: responde array (compat) y usa JWT', async () => {
    mockFrom({ table: 'inventory_items', data: [] });

    const response = await request(app).get('/api/inventory').set(AUTH);

    expect(response.status).toBe(200);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.pagination).toBeUndefined();
  });

  test('sin filtros: count y página sin predicados extra', async () => {
    const builders = mockFrom({ table: 'inventory_items', count: 40, data: [] });

    const response = await request(app).get('/api/inventory?page=1&limit=25').set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);

    const [countBuilder, listBuilder] = builders;
    expect(countBuilder.calls.eq).toEqual([['user_id', USER_ID]]);
    expect(countBuilder.calls.or).toEqual([]);
    expect(countBuilder.calls.range).toEqual([]);

    expect(listBuilder.calls.eq).toEqual([['user_id', USER_ID]]);
    expect(listBuilder.calls.range).toEqual([[0, 24]]);

    expect(response.body.pagination).toEqual({
      total: 40,
      page: 1,
      limit: 25,
      totalPages: 2,
    });
    expect(response.body.items).toEqual([]);
  });

  test('un solo filtro (category) se aplica a count y a la página', async () => {
    const builders = mockFrom({ table: 'inventory_items', count: 3, data: [] });

    const response = await request(app)
      .get('/api/inventory?page=1&limit=10&category=pinion')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.eq).toEqual([
        ['user_id', USER_ID],
        ['category', 'pinion'],
      ]);
      expect(b.calls.or).toEqual([]);
    }
    expect(listBuilder.calls.range).toEqual([[0, 9]]);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.pagination.totalPages).toBe(1);
  });

  test('varios filtros + página 2: range sobre el conjunto filtrado', async () => {
    const builders = mockFrom({ table: 'inventory_items', count: 23, data: [] });

    const response = await request(app)
      .get('/api/inventory?page=2&limit=10&category=motor&q=Slot&vehicle_id=veh-1')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.eq).toEqual([
        ['user_id', USER_ID],
        ['category', 'motor'],
        ['vehicle_id', 'veh-1'],
      ]);
      expect(b.calls.or).toEqual(['name.ilike.%Slot%,reference.ilike.%Slot%']);
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
    const builders = mockFrom({ table: 'inventory_items', count: FILTERED_COUNT, data: [] });

    const response = await request(app)
      .get('/api/inventory?page=1&limit=5&category=crown&q=GT')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    expect(filterFingerprint(countBuilder)).toEqual(filterFingerprint(listBuilder));
    expect(filterFingerprint(countBuilder)).toEqual({
      eq: [['category', 'crown']],
      or: ['name.ilike.%GT%,reference.ilike.%GT%'],
      not: [],
      gt: [],
    });

    expect(response.body.pagination.total).toBe(FILTERED_COUNT);
    expect(response.body.pagination.totalPages).toBe(4);
    expect(listBuilder.calls.range).toEqual([[0, 4]]);
  });

  test('low_stock + página 2: total del conjunto post-filtrado y slice correcto', async () => {
    const data = [
      { id: 'a', quantity: 1, min_stock: 2, vehicle_id: null },
      { id: 'b', quantity: 5, min_stock: 2, vehicle_id: null },
      { id: 'c', quantity: 0, min_stock: 1, vehicle_id: null },
      { id: 'd', quantity: 2, min_stock: 2, vehicle_id: null },
    ];
    const builders = mockFrom({ table: 'inventory_items', data });

    const response = await request(app)
      .get('/api/inventory?page=2&limit=2&low_stock=true')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(1);
    expect(builders[0].calls.not).toEqual([['min_stock', 'is', null]]);
    expect(builders[0].calls.range).toEqual([]);
    expect(response.body.items.map((r) => r.id)).toEqual(['d']);
    expect(response.body.pagination).toEqual({
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
  });

  test('in_stock + página 2: quantity > 0 en count y lista, con range', async () => {
    const builders = mockFrom({ table: 'inventory_items', count: 26, data: [] });

    const response = await request(app)
      .get('/api/inventory?page=2&limit=25&in_stock=true')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.gt).toEqual([['quantity', 0]]);
    }
    expect(listBuilder.calls.range).toEqual([[25, 49]]);
    expect(countBuilder.calls.range).toEqual([]);
    expect(response.body.pagination).toEqual({
      total: 26,
      page: 2,
      limit: 25,
      totalPages: 2,
    });
  });
});

describe('GET /api/inventory/parts — filtros y paginación en servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('sin filtros: count y página sobre parts; usa cliente JWT', async () => {
    const builders = mockFrom({ table: 'parts', count: 40, data: [] });

    const response = await request(app).get('/api/inventory/parts?page=1&limit=25').set(AUTH);

    expect(response.status).toBe(200);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;
    expect(countBuilder.calls.eq).toEqual([['user_id', USER_ID]]);
    expect(countBuilder.calls.range).toEqual([]);
    expect(listBuilder.calls.range).toEqual([[0, 24]]);
    expect(response.body.pagination).toEqual({
      total: 40,
      page: 1,
      limit: 25,
      totalPages: 2,
    });
    expect(response.body.parts).toEqual([]);
  });

  test('varios filtros + página 2: mismos predicados en count y lista', async () => {
    const builders = mockFrom({ table: 'parts', count: 23, data: [] });

    const response = await request(app)
      .get('/api/inventory/parts?page=2&limit=10&category=pinion&q=Slot')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(builders).toHaveLength(2);
    const [countBuilder, listBuilder] = builders;

    for (const b of [countBuilder, listBuilder]) {
      expect(b.calls.eq).toEqual([
        ['user_id', USER_ID],
        ['category', 'pinion'],
      ]);
      expect(b.calls.or).toEqual([
        'name.ilike.%Slot%,reference.ilike.%Slot%,manufacturer.ilike.%Slot%',
      ]);
    }
    expect(listBuilder.calls.range).toEqual([[10, 19]]);
    expect(response.body.pagination).toEqual({
      total: 23,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });
});
