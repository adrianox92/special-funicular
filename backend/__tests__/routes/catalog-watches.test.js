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
      reference: 'C4555',
      model_name: 'Porsche 911',
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
