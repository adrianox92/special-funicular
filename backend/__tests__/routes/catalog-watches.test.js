jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return { createClient: jest.fn(() => mockSupabase) };
});

const mockServiceClient = { from: jest.fn() };

jest.mock('../../lib/supabaseClients', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    getAnonClient: jest.fn(() => mockSupabase),
    getServiceClient: jest.fn(() => mockServiceClient),
    getServiceOrAnonClient: jest.fn(() => mockServiceClient),
    createUserScopedClient: jest.fn(() => mockSupabase),
    createServerClient: jest.fn(() => mockSupabase),
  };
});

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OFFER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SHOP_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WATCH_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function listApi(data) {
  const api = {
    select: jest.fn(() => api),
    eq: jest.fn(() => api),
    gte: jest.fn(() => api),
    lte: jest.fn(() => api),
    in: jest.fn(() => api),
    order: jest.fn(() => api),
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };
  return api;
}

describe('POST /api/catalog-watches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com' } },
      error: null,
    });
  });

  test('guarda la búsqueda y avisa si ya hay una oferta que cumple', async () => {
    const watch = {
      id: WATCH_ID,
      user_id: USER_ID,
      catalog_item_id: ITEM_ID,
      max_price: 50,
      currency: 'EUR',
    };
    const inserted = [];
    const saved = {};

    mockSupabase.from.mockImplementation((table) => {
      if (table !== 'catalog_price_watches') throw new Error(`tabla inesperada ${table}`);
      const api = {
        upsert: jest.fn((payload) => {
          saved.payload = payload;
          return api;
        }),
        select: jest.fn(() => api),
        single: jest.fn().mockResolvedValue({ data: watch, error: null }),
      };
      return api;
    });

    mockServiceClient.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') {
        const api = {
          select: jest.fn(() => api),
          eq: jest.fn(() => api),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: ITEM_ID }, error: null }),
        };
        return api;
      }
      if (table === 'catalog_shop_offers') {
        return listApi([{
          id: OFFER_ID,
          shop_id: SHOP_ID,
          catalog_item_id: ITEM_ID,
          price: 40,
          currency: 'EUR',
          short_code: 'Ab3kX9p',
          in_stock: true,
          last_checked_at: new Date().toISOString(),
          catalog_shops: { name: 'Evotec', active: true },
          slot_catalog_items: { reference: 'C4555', model_name: 'Porsche 911' },
        }]);
      }
      if (table === 'catalog_price_watches') return listApi([watch]);
      if (table === 'catalog_price_watch_notices') {
        const api = {
          select: jest.fn(() => api),
          eq: jest.fn(() => api),
          in: jest.fn(() => api),
          order: jest.fn(() => api),
          insert: jest.fn((row) => {
            inserted.push(row);
            return Promise.resolve({ error: null });
          }),
          then(onFulfilled, onRejected) {
            return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
          },
        };
        return api;
      }
      throw new Error(`tabla inesperada ${table}`);
    });

    const res = await request(app)
      .post('/api/catalog-watches')
      .set('Authorization', 'Bearer test-token')
      .send({ catalogItemId: ITEM_ID, maxPrice: 50 });

    expect(res.status).toBe(201);
    expect(res.body.watch).toEqual(expect.objectContaining({
      id: WATCH_ID,
      catalog_item_id: ITEM_ID,
      max_price: 50,
    }));
    expect(res.body.noticesCreated).toBe(1);
    expect(res.body.matchedOfferIds).toEqual([OFFER_ID]);
    expect(saved.payload).toEqual(expect.objectContaining({
      user_id: USER_ID,
      catalog_item_id: ITEM_ID,
      max_price: 50,
      currency: 'EUR',
    }));
    expect(inserted[0]).toEqual(expect.objectContaining({
      user_id: USER_ID,
      offer_id: OFFER_ID,
      shop_name: 'Evotec',
      price: 40,
      currency: 'EUR',
      short_code: 'Ab3kX9p',
      reference: 'C4555',
      model_name: 'Porsche 911',
    }));
  });

  test('sin catalogItemId lista las alertas y marca las tiendas que cumplen ahora', async () => {
    const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const brandId = '11111111-1111-4111-8111-111111111111';
    const cheapId = '22222222-2222-4222-8222-222222222222';
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();

    mockSupabase.from.mockImplementation((table) => {
      if (table !== 'catalog_price_watches') throw new Error(`tabla inesperada ${table}`);
      return listApi([
        {
          id: WATCH_ID,
          catalog_item_id: ITEM_ID,
          max_price: 50,
          currency: 'EUR',
          updated_at: '2026-11-26T10:00:00.000Z',
        },
        {
          id: otherId,
          catalog_item_id: ITEM_ID,
          max_price: 20,
          currency: 'EUR',
          updated_at: '2026-11-26T12:00:00.000Z',
        },
      ]);
    });

    mockServiceClient.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') {
        return listApi([{
          id: ITEM_ID,
          reference: 'C4555',
          model_name: 'Porsche 911',
          manufacturer_id: brandId,
        }]);
      }
      if (table === 'slot_catalog_brands') {
        return listApi([{ id: brandId, name: 'Scalextric' }]);
      }
      if (table === 'catalog_shop_offers') {
        return listApi([
          {
            id: OFFER_ID,
            catalog_item_id: ITEM_ID,
            price: 40,
            currency: 'EUR',
            in_stock: true,
            short_code: 'Ab3kX9p',
            last_checked_at: fresh,
            catalog_shops: { name: 'Evotec', active: true },
          },
          {
            id: cheapId,
            catalog_item_id: ITEM_ID,
            price: 10,
            currency: 'USD',
            in_stock: true,
            short_code: 'Zz9kX9p',
            last_checked_at: fresh,
            catalog_shops: { name: 'Otra', active: true },
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            catalog_item_id: ITEM_ID,
            price: 30,
            currency: 'EUR',
            in_stock: true,
            short_code: 'OldCode',
            last_checked_at: stale,
            catalog_shops: { name: 'Vieja', active: true },
          },
        ]);
      }
      throw new Error(`tabla inesperada ${table}`);
    });

    const res = await request(app)
      .get('/api/catalog-watches')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(2);
    expect(res.body.alerts[0]).toEqual(expect.objectContaining({
      id: WATCH_ID,
      reference: 'C4555',
      model_name: 'Porsche 911',
      manufacturer: 'Scalextric',
      max_price: 50,
    }));
    expect(res.body.alerts[0].matches).toEqual([
      expect.objectContaining({
        offer_id: OFFER_ID,
        shop_name: 'Evotec',
        price: 40,
        short_code: 'Ab3kX9p',
      }),
    ]);
    expect(res.body.alerts[1]).toEqual(expect.objectContaining({
      id: otherId,
      matches: [],
    }));
  });

  test('rechaza un precio que no es positivo', async () => {
    const res = await request(app)
      .post('/api/catalog-watches')
      .set('Authorization', 'Bearer test-token')
      .send({ catalogItemId: ITEM_ID, maxPrice: 0 });
    expect(res.status).toBe(400);
  });
});
