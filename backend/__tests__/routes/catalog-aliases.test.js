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

jest.mock('../../lib/catalogImageStorage', () => ({
  CATALOG_IMAGES_BUCKET: 'catalog-images',
  uploadCatalogImageBuffer: jest.fn(),
  uploadBrandLogoBuffer: jest.fn(),
  catalogStoragePathFromPublicUrl: jest.fn(),
  removeCatalogObjectByPublicUrl: jest.fn().mockResolvedValue({ error: null }),
}));

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');

const ADMIN_EMAIL = 'admin@example.com';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MFG_ID = '22222222-2222-4222-8222-222222222222';

function thenable(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    or: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn((payload) => {
      builder.updatePayload = payload;
      return builder;
    }),
    delete: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('admin catalog aliases + EAN', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
  });

  afterAll(() => {
    if (previousAdmins === undefined) delete process.env.LICENSE_ADMIN_EMAILS;
    else process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
  });

  test('POST /items guarda EAN canónico y aliases', async () => {
    const inserted = thenable({ data: { id: ITEM_ID }, error: null });
    const aliasRow = {
      id: '33333333-3333-4333-8333-333333333333',
      catalog_item_id: ITEM_ID,
      alias_reference: 'A10068X300',
      alias_type: 'market',
      market: 'INT',
      ean: '8436572913349',
    };
    const aliases = thenable({ data: [aliasRow], error: null });
    const full = thenable({
      data: {
        id: ITEM_ID,
        reference: 'A10068S300',
        ean: '8436572913332',
        manufacturer_id: MFG_ID,
        model_name: 'Ford Puma',
      },
      error: null,
    });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return inserted;
      if (table === 'slot_catalog_items_with_ratings') return full;
      if (table === 'slot_catalog_item_aliases') return aliases;
      return thenable({ data: null, error: null });
    });

    const response = await request(app)
      .post('/api/catalog/items')
      .set('Authorization', 'Bearer test-token')
      .field('reference', 'A10068S300')
      .field('manufacturer_id', MFG_ID)
      .field('model_name', 'Ford Puma')
      .field('ean', '8436572913332')
      .field(
        'aliases',
        JSON.stringify([
          {
            alias_reference: 'A10068X300',
            alias_type: 'market',
            market: 'INT',
            ean: '8436572913349',
            brand_label: 'SCX',
          },
        ]),
      );

    expect(response.status).toBe(201);
    expect(response.body.ean).toBe('8436572913332');
    expect(response.body.aliases).toEqual([
      expect.objectContaining({
        alias_reference: 'A10068X300',
        ean: '8436572913349',
      }),
    ]);
    expect(aliases.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        catalog_item_id: ITEM_ID,
        alias_reference: 'A10068X300',
        alias_type: 'market',
        market: 'INT',
        ean: '8436572913349',
        brand_label: 'SCX',
      }),
    ]);
  });

  test('PUT /items/:id sin aliases no toca la tabla hija', async () => {
    const existing = {
      id: ITEM_ID,
      reference: 'A10068S300',
      ean: '8436572913332',
      manufacturer_id: MFG_ID,
      model_name: 'Ford Puma',
    };
    const items = thenable({ data: existing, error: null });
    const aliases = thenable({ data: [], error: null });
    const full = thenable({ data: existing, error: null });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return items;
      if (table === 'slot_catalog_items_with_ratings') return full;
      if (table === 'slot_catalog_item_aliases') return aliases;
      return thenable({ data: null, error: null });
    });

    const response = await request(app)
      .put(`/api/catalog/items/${ITEM_ID}`)
      .set('Authorization', 'Bearer test-token')
      .field('reference', existing.reference)
      .field('manufacturer_id', MFG_ID)
      .field('model_name', existing.model_name);

    expect(response.status).toBe(200);
    expect(items.updatePayload).toEqual(expect.objectContaining({ ean: '8436572913332' }));
    expect(aliases.delete).not.toHaveBeenCalled();
    expect(aliases.insert).not.toHaveBeenCalled();
  });

  test('GET /search incluye matches por alias y EAN', async () => {
    const item = {
      id: ITEM_ID,
      reference: 'A10068S300',
      ean: '8436572913332',
      manufacturer_id: MFG_ID,
      model_name: 'Ford Puma',
    };
    const empty = thenable({ data: [], error: null });
    const byEan = thenable({ data: [item], error: null });
    const byAlias = thenable({ data: [{ catalog_item_id: ITEM_ID }], error: null });
    const byId = thenable({ data: [item], error: null });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_item_aliases') return byAlias;
      if (table === 'slot_catalog_items_with_ratings') {
        return {
          select: jest.fn(() => ({
            ilike: jest.fn((col) => {
              if (col === 'ean') return byEan;
              return empty;
            }),
            in: jest.fn(() => byId),
          })),
        };
      }
      return empty;
    });

    const response = await request(app)
      .get('/api/catalog/search')
      .query({ q: 'A10068X300' })
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ id: ITEM_ID })]);
  });
});
