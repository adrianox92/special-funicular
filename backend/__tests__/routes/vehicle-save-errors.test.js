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

describe('POST /api/vehicles — log de fallos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  test('400 por catalog_item_id inexistente deja fila en vehicle_save_errors', async () => {
    const errorLogs = [];
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
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
      throw new Error(`from(${table}) inesperado`);
    });

    const response = await request(app)
      .post('/api/vehicles')
      .set(AUTH)
      .field('model', 'Cadillac CTS-V Coupe')
      .field('manufacturer', 'Scaleauto')
      .field('type', 'Turismo')
      .field('catalog_item_id', ITEM_ID)
      .field('vehicle_save_source', 'suggest');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('catalog_item_id no existe en el catálogo');
    expect(errorLogs).toEqual([
      expect.objectContaining({
        user_id: USER_ID,
        route: 'POST /api/vehicles',
        status: 400,
        error_message: 'catalog_item_id no existe en el catálogo',
        catalog_item_id_raw: ITEM_ID,
        source: 'suggest',
      }),
    ]);
  });

  test('PUT 404 también deja fila en vehicle_save_errors', async () => {
    const errorLogs = [];
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'vehicles') {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          single: jest.fn(async () => ({ data: null, error: { message: 'not found' } })),
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
      throw new Error(`from(${table}) inesperado`);
    });

    const response = await request(app)
      .put(`/api/vehicles/${ITEM_ID}`)
      .set(AUTH)
      .field('model', 'Cadillac')
      .field('vehicle_save_source', 'edit');

    expect(response.status).toBe(404);
    expect(errorLogs).toEqual([
      expect.objectContaining({
        user_id: USER_ID,
        route: 'PUT /api/vehicles/:id',
        status: 404,
        error_message: 'Vehículo no encontrado',
        source: 'edit',
      }),
    ]);
  });
});
