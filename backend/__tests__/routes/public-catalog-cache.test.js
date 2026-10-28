jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return { createClient: jest.fn(() => mockSupabase) };
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
const { clearPublicCatalogCache, shapeFacets } = require('../../routes/publicCatalog');

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const ITEM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function thenable(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    is: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    or: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('caché del catálogo público', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPublicCatalogCache();
    process.env.CATALOG_BOT_GATE = 'off';
    delete process.env.BLOCKED_IPS;
    mockSupabase.rpc.mockResolvedValue({ data: 0, error: null });
  });

  it('shapeFacets ordena marcas y años', () => {
    const body = shapeFacets({
      manufacturers: [
        { name: 'Ninco', slug: 'ninco', count: 2 },
        { name: 'Scalextric', slug: 'scalextric', count: 4 },
      ],
      vehicle_types: [{ name: 'GT', count: 1 }],
      tractions: [],
      motor_positions: [],
      years: [{ year: 2019, count: 1 }, { year: 2024, count: 3 }],
    });
    expect(body.manufacturers.map((row) => row.name)).toEqual(['Ninco', 'Scalextric']);
    expect(body.years.map((row) => row.year)).toEqual([2024, 2019]);
  });

  it('la segunda lectura de facets no vuelve a llamar al RPC', async () => {
    mockSupabase.rpc.mockImplementation((name) => {
      if (name === 'catalog_public_facets') {
        return Promise.resolve({
          data: {
            manufacturers: [{ name: 'Scalextric', slug: 'scalextric', count: 3 }],
            vehicle_types: [{ name: 'Turismo', count: 3 }],
            tractions: [],
            motor_positions: [],
            years: [{ year: 2020, count: 3 }],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const first = await request(app)
      .get('/api/public/catalog/facets')
      .set('User-Agent', CHROME)
      .expect(200);
    const second = await request(app)
      .get('/api/public/catalog/facets')
      .set('User-Agent', CHROME)
      .expect(200);

    expect(second.body).toEqual(first.body);
    expect(first.body.manufacturers[0].name).toBe('Scalextric');
    const facetCalls = mockSupabase.rpc.mock.calls.filter((call) => call[0] === 'catalog_public_facets');
    expect(facetCalls).toHaveLength(1);
  });

  it('repite el listado desde caché y vuelve a consultar si cambia la página', async () => {
    mockSupabase.from.mockImplementation(() => thenable({ data: [{ id: ITEM_A, reference: 'C1' }], error: null, count: 1 }));

    await request(app).get('/api/public/catalog/items?limit=24').set('User-Agent', CHROME).expect(200);
    const callsAfterFirst = mockSupabase.from.mock.calls.length;
    await request(app).get('/api/public/catalog/items?limit=24').set('User-Agent', CHROME).expect(200);
    expect(mockSupabase.from.mock.calls.length).toBe(callsAfterFirst);

    await request(app).get('/api/public/catalog/items?limit=24&page=2').set('User-Agent', CHROME).expect(200);
    expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('repite la ficha desde caché y consulta otra ficha', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items_with_ratings') {
        return thenable({
          data: {
            id: ITEM_A,
            reference: 'C1',
            manufacturer: 'Scalextric',
            model_name: 'Audi',
          },
          error: null,
        });
      }
      return thenable({ data: [], error: null });
    });

    await request(app).get(`/api/public/catalog/items/${ITEM_A}`).set('User-Agent', CHROME).expect(200);
    const callsAfterFirst = mockSupabase.from.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await request(app).get(`/api/public/catalog/items/${ITEM_A}`).set('User-Agent', CHROME).expect(200);
    expect(mockSupabase.from.mock.calls.length).toBe(callsAfterFirst);

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items_with_ratings') {
        return thenable({
          data: { id: ITEM_B, reference: 'C2', manufacturer: 'Ninco' },
          error: null,
        });
      }
      return thenable({ data: [], error: null });
    });
    const other = await request(app)
      .get(`/api/public/catalog/items/${ITEM_B}`)
      .set('User-Agent', CHROME)
      .expect(200);
    expect(other.body.id).toBe(ITEM_B);
    expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
