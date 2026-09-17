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

const IN_CATALOG_ROW = {
  reference: 'AV52802',
  vehicle_count: 4,
  distinct_user_count: 2,
  linkable_vehicle_count: 2,
  linkable_distinct_user_count: 1,
  linkable_vehicle_count_sample_mfg: 2,
  linkable_distinct_user_count_sample_mfg: 1,
  sample_manufacturer: 'Avant Slot',
  sample_model: 'GT3',
  in_catalog: true,
  catalog_item_count: 1,
  catalog_item_id: '11111111-1111-4111-8111-111111111111',
  catalog_manufacturer_id: '22222222-2222-4222-8222-222222222222',
  catalog_reference: 'AV52802',
  catalog_manufacturer: 'Avant Slot',
};

describe('GET /api/admin/vehicle-refs-not-in-catalog', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: { total: 0, limit: 25, offset: 0, only_unlinked: false, q: null, rows: [] },
      error: null,
    });
  });

  afterAll(() => {
    if (previousAdmins === undefined) {
      delete process.env.LICENSE_ADMIN_EMAILS;
    } else {
      process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
    }
  });

  test('403 si el usuario no es administrador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'other', email: 'user@example.com' } },
      error: null,
    });

    const response = await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('503 si falta el cliente service-role', async () => {
    getServiceClient.mockReturnValueOnce(null);

    const response = await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(503);
  });

  test('sin q llama al RPC con p_q null (ranking solo ausentes)', async () => {
    const response = await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog?limit=25&offset=0')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_vehicle_refs_missing_catalog', {
      p_limit: 25,
      p_offset: 0,
      p_only_unlinked: false,
    });
    expect(response.body.q).toBeNull();
    expect(response.body.rows).toEqual([]);
  });

  test('con q pasa p_q y reenvía flags in_catalog / catalog_item_id', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        total: 1,
        limit: 25,
        offset: 0,
        only_unlinked: false,
        q: 'av52802',
        rows: [IN_CATALOG_ROW],
      },
      error: null,
    });

    const response = await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog?q=AV52802')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_vehicle_refs_missing_catalog', {
      p_limit: 25,
      p_offset: 0,
      p_only_unlinked: false,
      p_q: 'AV52802',
    });
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toMatchObject({
      reference: 'AV52802',
      in_catalog: true,
      catalog_item_count: 1,
      catalog_item_id: IN_CATALOG_ROW.catalog_item_id,
      catalog_manufacturer_id: IN_CATALOG_ROW.catalog_manufacturer_id,
      linkable_vehicle_count: 2,
    });
  });

  test('alias ?ref= se envía como p_q', async () => {
    await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog?ref=FOO')
      .set('Authorization', 'Bearer test-token');

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'admin_vehicle_refs_missing_catalog',
      expect.objectContaining({ p_q: 'FOO' }),
    );
  });
});
