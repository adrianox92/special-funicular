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
const { createVehicleMultipartFields, applyMultipart } = require('../helpers/createVehicleMultipart');

const USER_ID = 'test-user-id';
const AUTH = { Authorization: 'Bearer test-token' };
const ITEM_ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';

function mockPostLookups({ catalogRow, vehicleRow }) {
  const catalogEq = [];
  const inserts = [];
  const errorLogs = [];
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'slot_catalog_items') {
      const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((col, val) => {
          catalogEq.push([col, val]);
          return builder;
        }),
        maybeSingle: jest.fn(async () => ({ data: catalogRow, error: null })),
      };
      return builder;
    }
    if (table === 'vehicles') {
      const builder = {
        insert: jest.fn((payload) => {
          inserts.push(payload);
          return builder;
        }),
        select: jest.fn(() => builder),
        single: jest.fn(async () => ({
          data: vehicleRow || { id: VEHICLE_ID, catalog_item_id: inserts[0]?.[0]?.catalog_item_id ?? null },
          error: null,
        })),
      };
      return builder;
    }
    if (table === 'vehicle_save_errors') {
      return {
        insert: jest.fn((payload) => {
          errorLogs.push(payload);
          return Promise.resolve({ data: payload, error: null });
        }),
      };
    }
    throw new Error(`from(${table}) inesperado en POST /vehicles`);
  });
  return { catalogEq, inserts, errorLogs };
}

function postFromFrontend(vehicle, opts) {
  const req = request(app).post('/api/vehicles').set(AUTH);
  return applyMultipart(req, createVehicleMultipartFields(vehicle, opts));
}

describe('POST /api/vehicles — FormData real (Multer) de los tres flujos de alta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('a) «Es este»: vehicle.catalog_item_id y catalogItemId coinciden; se guarda un UUID', async () => {
    const { catalogEq, inserts } = mockPostLookups({
      catalogRow: { id: ITEM_ID },
    });
    const vehicle = {
      model: 'Cadillac CTS-V Coupe',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
      reference: 'SC6378',
      catalog_item_id: ITEM_ID,
    };

    const response = await postFromFrontend(vehicle, {
      catalogItemId: ITEM_ID,
      source: 'suggest',
    });

    expect(response.status).toBe(201);
    expect(catalogEq).toEqual([['id', ITEM_ID]]);
    expect(inserts[0][0].catalog_item_id).toBe(ITEM_ID);
    expect(inserts[0][0].user_id).toBe(USER_ID);
  });

  test('a-regresión) Multer recibe catalog_item_id dos veces y aun así guarda el UUID', async () => {
    const { catalogEq, inserts } = mockPostLookups({
      catalogRow: { id: ITEM_ID },
    });

    const response = await request(app)
      .post('/api/vehicles')
      .set(AUTH)
      .field('model', 'Cadillac CTS-V Coupe')
      .field('manufacturer', 'Scaleauto')
      .field('type', 'Turismo')
      .field('catalog_item_id', ITEM_ID)
      .field('catalog_item_id', ITEM_ID)
      .field('vehicle_save_source', 'suggest');

    expect(response.status).toBe(201);
    expect(catalogEq).toEqual([['id', ITEM_ID]]);
    expect(inserts[0][0].catalog_item_id).toBe(ITEM_ID);
  });

  test('b) pestaña Catálogo / ?catalogItemId=: un solo id en el insert', async () => {
    const { catalogEq, inserts } = mockPostLookups({
      catalogRow: { id: ITEM_ID },
    });
    const vehicle = {
      model: 'Cadillac CTS-V Coupe',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
      reference: 'SC6378',
    };

    const response = await postFromFrontend(vehicle, {
      catalogItemId: ITEM_ID,
      source: 'catalog_tab',
    });

    expect(response.status).toBe(201);
    expect(catalogEq).toEqual([['id', ITEM_ID]]);
    expect(inserts[0][0].catalog_item_id).toBe(ITEM_ID);
  });

  test('c) sin catálogo: catalog_item_id null y no se consulta el catálogo', async () => {
    const { catalogEq, inserts } = mockPostLookups({ catalogRow: null });
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    const response = await postFromFrontend(
      { model: 'Libre', manufacturer: 'Ninco', type: 'GT' },
      { source: 'manual' },
    );

    expect(response.status).toBe(201);
    expect(catalogEq).toEqual([]);
    expect(inserts[0][0].catalog_item_id).toBeNull();
  });
});
