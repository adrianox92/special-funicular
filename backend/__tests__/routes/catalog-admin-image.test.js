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
const { removeCatalogObjectByPublicUrl } = require('../../lib/catalogImageStorage');

const ADMIN_EMAIL = 'admin@example.com';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MFG_ID = '22222222-2222-4222-8222-222222222222';
const IMAGE_URL = 'https://test.supabase.co/storage/v1/object/public/catalog-images/catalog/foo.jpg';

const EXISTING = {
  id: ITEM_ID,
  reference: 'AV1',
  manufacturer_id: MFG_ID,
  model_name: 'GT3',
  vehicle_type: 'GT',
  traction: '4x2',
  motor_position: null,
  commercial_release_year: 2020,
  discontinued: false,
  upcoming_release: false,
  dorsal: null,
  limited_edition: false,
  limited_edition_total: null,
  real_race_results_url: null,
  real_race_photos_url: null,
  image_url: IMAGE_URL,
};

function createItemsBuilder(existing) {
  const builder = {
    updatePayload: null,
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    update: jest.fn((payload) => {
      builder.updatePayload = payload;
      return builder;
    }),
    maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }),
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function createRatingsBuilder(row) {
  return {
    select: jest.fn(function select() {
      return this;
    }),
    eq: jest.fn(function eq() {
      return this;
    }),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
}

describe('admin catalog item image', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;
  let itemsBuilder;
  let ratingsBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
    itemsBuilder = createItemsBuilder(EXISTING);
    ratingsBuilder = createRatingsBuilder({ ...EXISTING, image_url: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsBuilder;
      if (table === 'slot_catalog_items_with_ratings') return ratingsBuilder;
      return createItemsBuilder(null);
    });
    removeCatalogObjectByPublicUrl.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    if (previousAdmins === undefined) {
      delete process.env.LICENSE_ADMIN_EMAILS;
    } else {
      process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
    }
  });

  test('PUT /items/:id con clear_image quita la foto y el objeto', async () => {
    const response = await request(app)
      .put(`/api/catalog/items/${ITEM_ID}`)
      .set('Authorization', 'Bearer test-token')
      .field('reference', EXISTING.reference)
      .field('manufacturer_id', MFG_ID)
      .field('model_name', EXISTING.model_name)
      .field('clear_image', 'true');

    expect(response.status).toBe(200);
    expect(removeCatalogObjectByPublicUrl).toHaveBeenCalledWith(mockSupabase, IMAGE_URL);
    expect(itemsBuilder.updatePayload).toEqual(
      expect.objectContaining({
        image_url: null,
      }),
    );
    expect(response.body.image_url).toBeNull();
  });

  test('PUT /items/:id con año vacío lo deja a null', async () => {
    ratingsBuilder = createRatingsBuilder({ ...EXISTING, commercial_release_year: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsBuilder;
      if (table === 'slot_catalog_items_with_ratings') return ratingsBuilder;
      return createItemsBuilder(null);
    });

    const response = await request(app)
      .put(`/api/catalog/items/${ITEM_ID}`)
      .set('Authorization', 'Bearer test-token')
      .field('reference', EXISTING.reference)
      .field('manufacturer_id', MFG_ID)
      .field('model_name', EXISTING.model_name)
      .field('commercial_release_year', '');

    expect(response.status).toBe(200);
    expect(itemsBuilder.updatePayload).toEqual(
      expect.objectContaining({
        commercial_release_year: null,
      }),
    );
    expect(response.body.commercial_release_year).toBeNull();
  });

  test('PUT /items/:id sin campo de año conserva el existente', async () => {
    ratingsBuilder = createRatingsBuilder(EXISTING);
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsBuilder;
      if (table === 'slot_catalog_items_with_ratings') return ratingsBuilder;
      return createItemsBuilder(null);
    });

    const response = await request(app)
      .put(`/api/catalog/items/${ITEM_ID}`)
      .set('Authorization', 'Bearer test-token')
      .field('reference', EXISTING.reference)
      .field('manufacturer_id', MFG_ID)
      .field('model_name', EXISTING.model_name);

    expect(response.status).toBe(200);
    expect(itemsBuilder.updatePayload).toEqual(
      expect.objectContaining({
        commercial_release_year: EXISTING.commercial_release_year,
      }),
    );
  });

  test('PUT /items/:id sin clear_image conserva la foto', async () => {
    ratingsBuilder = createRatingsBuilder(EXISTING);
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsBuilder;
      if (table === 'slot_catalog_items_with_ratings') return ratingsBuilder;
      return createItemsBuilder(null);
    });

    const response = await request(app)
      .put(`/api/catalog/items/${ITEM_ID}`)
      .set('Authorization', 'Bearer test-token')
      .field('reference', EXISTING.reference)
      .field('manufacturer_id', MFG_ID)
      .field('model_name', EXISTING.model_name);

    expect(response.status).toBe(200);
    expect(removeCatalogObjectByPublicUrl).not.toHaveBeenCalled();
    expect(itemsBuilder.updatePayload).toEqual(
      expect.objectContaining({
        image_url: IMAGE_URL,
      }),
    );
  });

  test('DELETE /items/:id/image quita la foto y el objeto', async () => {
    const response = await request(app)
      .delete(`/api/catalog/items/${ITEM_ID}/image`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(removeCatalogObjectByPublicUrl).toHaveBeenCalledWith(mockSupabase, IMAGE_URL);
    expect(itemsBuilder.updatePayload).toEqual(
      expect.objectContaining({
        image_url: null,
      }),
    );
    expect(response.body.image_url).toBeNull();
  });

  test('DELETE /items/:id/image 404 si no hay imagen', async () => {
    itemsBuilder = createItemsBuilder({ ...EXISTING, image_url: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsBuilder;
      if (table === 'slot_catalog_items_with_ratings') return ratingsBuilder;
      return createItemsBuilder(null);
    });

    const response = await request(app)
      .delete(`/api/catalog/items/${ITEM_ID}/image`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(removeCatalogObjectByPublicUrl).not.toHaveBeenCalled();
    expect(itemsBuilder.updatePayload).toBeNull();
  });

  test('403 si el usuario no es administrador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'other', email: 'user@example.com' } },
      error: null,
    });

    const response = await request(app)
      .delete(`/api/catalog/items/${ITEM_ID}/image`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(removeCatalogObjectByPublicUrl).not.toHaveBeenCalled();
  });
});
