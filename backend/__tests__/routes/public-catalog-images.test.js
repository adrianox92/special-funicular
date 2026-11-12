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
const { PUBLIC_ITEMS_MAX_LIMIT, clearPublicCatalogCache } = require('../../routes/publicCatalog');
const { isCatalogInternalRequest } = require('../../middleware/rateLimits');

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const CATALOG =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';
const LOGO =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/brands/scx.webp';

function thenable(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    or: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('GET /api/public/catalog image URLs', () => {
  const previousOrigin = process.env.PUBLIC_IMAGE_ORIGIN;
  const previousGate = process.env.CATALOG_BOT_GATE;

  beforeEach(() => {
    jest.clearAllMocks();
    clearPublicCatalogCache();
    process.env.PUBLIC_IMAGE_ORIGIN = 'https://www.slotdatabase.es';
    process.env.CATALOG_BOT_GATE = 'off';
    delete process.env.BLOCKED_IPS;
  });

  afterAll(() => {
    if (previousOrigin === undefined) delete process.env.PUBLIC_IMAGE_ORIGIN;
    else process.env.PUBLIC_IMAGE_ORIGIN = previousOrigin;
    if (previousGate === undefined) delete process.env.CATALOG_BOT_GATE;
    else process.env.CATALOG_BOT_GATE = previousGate;
  });

  test('brands y listado reescriben logos/fotos a /api/img y no exponen supabase', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_brands') {
        return thenable({
          data: [{ id: 'b1', name: 'Scalextric', slug: 'scalextric', logo_url: LOGO }],
          error: null,
        });
      }
      return thenable({
        data: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            reference: 'C1234',
            image_url: CATALOG,
            manufacturer_logo_url: LOGO,
          },
        ],
        error: null,
        count: 1,
      });
    });

    const brands = await request(app)
      .get('/api/public/catalog/brands')
      .set('User-Agent', CHROME)
      .expect(200);
    expect(brands.body.brands[0].logo_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/brands/scx.webp',
    );
    expect(JSON.stringify(brands.body)).not.toMatch(/supabase\.co/i);

    const items = await request(app)
      .get('/api/public/catalog/items?limit=24')
      .set('User-Agent', CHROME)
      .expect(200);
    expect(items.body.items[0].image_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
    );
    expect(items.body.items[0].manufacturer_logo_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/brands/scx.webp',
    );
    expect(JSON.stringify(items.body)).not.toMatch(/storage\/v1\/object\/public/i);
  });

  test(`limit público se recorta a ${PUBLIC_ITEMS_MAX_LIMIT}`, async () => {
    expect(PUBLIC_ITEMS_MAX_LIMIT).toBeLessThan(100);
    mockSupabase.from.mockImplementation(() => thenable({ data: [], error: null, count: 0 }));

    const res = await request(app)
      .get('/api/public/catalog/items?limit=100')
      .set('User-Agent', CHROME)
      .expect(200);
    expect(res.body.limit).toBe(PUBLIC_ITEMS_MAX_LIMIT);
  });

  test('el SSR interno no consume el rate limit del catálogo si hay secreto', () => {
    const prev = process.env.CATALOG_INTERNAL_SECRET;
    process.env.CATALOG_INTERNAL_SECRET = 'ssr-secret';
    try {
      expect(
        isCatalogInternalRequest({ headers: { 'x-catalog-internal': 'ssr-secret' } }),
      ).toBe(true);
      expect(isCatalogInternalRequest({ headers: { 'x-catalog-internal': 'nope' } })).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.CATALOG_INTERNAL_SECRET;
      else process.env.CATALOG_INTERNAL_SECRET = prev;
    }
  });
});
