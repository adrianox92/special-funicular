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

const USER_ID = 'test-user-id';
const AUTH = { Authorization: 'Bearer test-token' };
const ITEM_ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';

function mockPostLookups({ catalogRow, vehicleRow }) {
  const catalogEq = [];
  const inserts = [];
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
        single: jest.fn(async () => ({ data: vehicleRow, error: null })),
      };
      return builder;
    }
    if (table === 'vehicle_save_errors') {
      return {
        insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }
    throw new Error(`from(${table}) inesperado en POST /vehicles`);
  });
  return { catalogEq, inserts };
}

function postVehicle(fields) {
  const req = request(app).post('/api/vehicles').set(AUTH);
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => req.field(key, v));
    } else {
      req.field(key, value);
    }
  });
  return req;
}

describe('POST /api/vehicles — catalog_item_id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('un UUID válido del catálogo se guarda', async () => {
    const { catalogEq, inserts } = mockPostLookups({
      catalogRow: { id: ITEM_ID, traction: '4x4' },
      vehicleRow: { id: VEHICLE_ID, catalog_item_id: ITEM_ID },
    });

    const response = await postVehicle({
      model: 'Cadillac CTS-V Coupe',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
      catalog_item_id: ITEM_ID,
    });

    expect(response.status).toBe(201);
    expect(catalogEq).toEqual([['id', ITEM_ID]]);
    expect(inserts[0][0].catalog_item_id).toBe(ITEM_ID);
  });

  test('campo duplicado (Multer array, como tras «Es este») usa el UUID y no 400', async () => {
    const { catalogEq, inserts } = mockPostLookups({
      catalogRow: { id: ITEM_ID, traction: '4x4' },
      vehicleRow: { id: VEHICLE_ID, catalog_item_id: ITEM_ID },
    });

    const response = await postVehicle({
      model: 'Cadillac CTS-V Coupe',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
      catalog_item_id: [ITEM_ID, ITEM_ID],
    });

    expect(response.status).toBe(201);
    expect(response.body.error).toBeUndefined();
    expect(catalogEq).toEqual([['id', ITEM_ID]]);
    expect(inserts[0][0].catalog_item_id).toBe(ITEM_ID);
  });

  test('UUID que no está en slot_catalog_items sigue devolviendo el 400 de siempre', async () => {
    mockPostLookups({
      catalogRow: null,
      vehicleRow: { id: VEHICLE_ID },
    });

    const response = await postVehicle({
      model: 'Cadillac CTS-V Coupe',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
      catalog_item_id: ITEM_ID,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('catalog_item_id no existe en el catálogo');
  });
});
