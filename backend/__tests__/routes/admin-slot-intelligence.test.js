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
const { getServiceClient } = require('../../lib/supabaseClients');

const ADMIN_EMAIL = 'admin@example.com';
const BRAND_ID = '11111111-1111-4111-8111-111111111111';

const SUMMARY = {
  computed_at: '2026-10-29T20:00:00.000Z',
  catalog_items_total: 10000,
  catalog_items_with_owners: 2500,
  coverage_pct: 25,
  linked_vehicle_count: 6000,
  linked_user_count: 400,
  vehicles_with_price: 1800,
  price_coverage_pct: 30,
  global_price_median: '49.90',
  global_price_p25: '30.00',
  global_price_p75: '70.00',
  publishable_item_count: 120,
  top10_refs_vehicle_share_pct: 12.5,
  top5_brands_vehicle_share_pct: 60,
  rarity_histogram: [{ bucket: '0', item_count: 7500 }],
  garage_price_basis: 'declared_as_eur',
};

const BRANDS = [
  {
    manufacturer_id: BRAND_ID,
    brand_name: 'Scalextric',
    catalog_item_count: 4000,
    items_with_owners: 900,
    coverage_pct: 22.5,
    vehicle_count: 3000,
    user_count: 200,
    garage_price_n: 800,
    garage_price_median: 45,
    listing_count: 10,
    listing_price_n: 8,
    listing_price_median: 52,
  },
];

const ITEMS = [
  {
    catalog_item_id: '22222222-2222-4222-8222-222222222222',
    manufacturer_id: BRAND_ID,
    brand_name: 'Scalextric',
    reference: 'C4032',
    model_name: 'Porsche 911',
    vehicle_count: 20,
    owner_count: 12,
    penetration_pct: 3,
    garage_price_n: 8,
    garage_price_median: 55,
    garage_price_p25: 40,
    garage_price_p75: 70,
    listing_count: 2,
    listing_other_currency_count: 0,
    listing_price_n: 2,
    listing_price_median: 60,
    listing_new_n: 0,
    listing_new_median: null,
    listing_used_n: 0,
    listing_used_median: null,
    listing_preorder_n: 0,
    listing_preorder_median: null,
    publishable: true,
    prices_publishable: true,
  },
];

function chain(resolved) {
  const builder = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(resolved)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('Slot Database Intelligence', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;
  let summaryReads = 0;
  let itemsBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    summaryReads = 0;
    itemsBuilder = null;
    delete process.env.SLOT_INTEL_STALE;
    SUMMARY.computed_at = new Date().toISOString();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: SUMMARY.computed_at, error: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_intelligence_summary') {
        summaryReads += 1;
        const row = summaryReads === 1 && process.env.SLOT_INTEL_STALE === '1'
          ? { computed_at: '2020-01-01T00:00:00.000Z' }
          : SUMMARY;
        return chain({ data: row, error: null });
      }
      if (table === 'slot_intelligence_brands') {
        return chain({ data: BRANDS, error: null });
      }
      if (table === 'slot_intelligence_purchase_places') {
        return chain({
          data: [{ scope: 'global', place_label: 'wallapop', vehicle_count: 40, user_count: 15 }],
          error: null,
        });
      }
      itemsBuilder = chain({ data: ITEMS, error: null, count: 2 });
      return itemsBuilder;
    });
  });

  afterEach(() => {
    delete process.env.SLOT_INTEL_STALE;
  });

  afterAll(() => {
    if (previousAdmins === undefined) delete process.env.LICENSE_ADMIN_EMAILS;
    else process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
  });

  test('403 si el usuario no es administrador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'other', email: 'user@example.com' } },
      error: null,
    });

    const response = await request(app)
      .get('/api/admin/slot-intelligence')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/administradores/i);
  });

  test('503 si falta el cliente service-role', async () => {
    getServiceClient.mockReturnValueOnce(null);

    const response = await request(app)
      .get('/api/admin/slot-intelligence')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(503);
  });

  test('400 si el orden no es válido', async () => {
    const response = await request(app)
      .get('/api/admin/slot-intelligence?sort=precio')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/sort/);
  });

  test('devuelve resumen, marcas y ficha, y convierte el precio numérico', async () => {
    const response = await request(app)
      .get('/api/admin/slot-intelligence')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.stale_refreshed).toBe(false);
    expect(response.body.summary.coverage_pct).toBe(25);
    expect(response.body.summary.global_price_median).toBe(49.9);
    expect(response.body.summary.vehicles_with_price).toBe(1800);
    expect(response.body.summary.publishable_item_count).toBe(120);
    expect(response.body.brands[0].brand_name).toBe('Scalextric');
    expect(response.body.brands[0].garage_price_median).toBe(45);
    expect(response.body.items.rows[0].reference).toBe('C4032');
    expect(response.body.items.rows[0].publishable).toBe(true);
    expect(response.body.items.rows[0].garage_price_median).toBe(55);
    expect(response.body.items.total).toBe(2);
    expect(response.body.places.global[0].place_label).toBe('wallapop');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('filtra fichas por marca, orden de precio y publicable', async () => {
    const response = await request(app)
      .get(
        `/api/admin/slot-intelligence?sort=garage_price&manufacturer_id=${BRAND_ID}&publishable=true&limit=50&offset=50`,
      )
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(itemsBuilder.eq).toHaveBeenCalledWith('manufacturer_id', BRAND_ID);
    expect(itemsBuilder.eq).toHaveBeenCalledWith('publishable', true);
    expect(itemsBuilder.order).toHaveBeenCalledWith('garage_price_median', {
      ascending: false,
      nullsFirst: false,
    });
    expect(itemsBuilder.range).toHaveBeenCalledWith(50, 99);
    expect(response.body.items.sort).toBe('garage_price');
    expect(response.body.items.manufacturer_id).toBe(BRAND_ID);
    expect(response.body.items.publishable).toBe(true);
  });

  test('recalcula si la foto tiene más de 6 horas', async () => {
    process.env.SLOT_INTEL_STALE = '1';

    const response = await request(app)
      .get('/api/admin/slot-intelligence')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.stale_refreshed).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('slot_intelligence_refresh');
    expect(response.body.summary.catalog_items_total).toBe(10000);
  });

  test('POST /refresh ejecuta el recálculo', async () => {
    const response = await request(app)
      .post('/api/admin/slot-intelligence/refresh')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('slot_intelligence_refresh');
    expect(response.body.computed_at).toBe(SUMMARY.computed_at);
  });
});
