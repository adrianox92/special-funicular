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

  test('con manufacturer pasa p_manufacturer y no p_q', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        total: 1,
        limit: 25,
        offset: 0,
        only_unlinked: false,
        q: null,
        manufacturer: 'ninco',
        rows: [{ ...IN_CATALOG_ROW, in_catalog: false, sample_manufacturer: 'Ninco' }],
      },
      error: null,
    });

    const response = await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog?manufacturer=Ninco')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_vehicle_refs_missing_catalog', {
      p_limit: 25,
      p_offset: 0,
      p_only_unlinked: false,
      p_manufacturer: 'Ninco',
    });
    expect(response.body.manufacturer).toBe('ninco');
    expect(response.body.rows[0].sample_manufacturer).toBe('Ninco');
  });

  test('alias ?mfg= se envía como p_manufacturer', async () => {
    await request(app)
      .get('/api/admin/vehicle-refs-not-in-catalog?mfg=Slot.it')
      .set('Authorization', 'Bearer test-token');

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'admin_vehicle_refs_missing_catalog',
      expect.objectContaining({ p_manufacturer: 'Slot.it' }),
    );
  });
});

function queryChain(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('enlace de referencias de garaje al catálogo', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;
  const ITEM_ID = '900e8585-d110-45a9-915c-c5669ddaca7e';
  const MFG_ID = '9a49046d-edc6-4a04-9eda-9bcf4aeb5f4d';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: 2, error: null });
  });

  afterAll(() => {
    if (previousAdmins === undefined) delete process.env.LICENSE_ADMIN_EMAILS;
    else process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
  });

  test('GET suggestions llama al RPC con referencia y marca', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: ITEM_ID,
          reference: '20027131',
          manufacturer_id: MFG_ID,
          manufacturer: 'Carrera',
          model_name: 'Mercedes C DTM 2006 red',
          match: 'suffix',
          manufacturer_rank: 0,
        },
      ],
      error: null,
    });

    const response = await request(app)
      .get('/api/admin/catalog-link-suggestions?reference=27131&manufacturer=Carrera')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_suggest_catalog_items_for_garage_ref', {
      p_reference: '27131',
      p_manufacturer: 'Carrera',
    });
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.suggestions[0].reference).toBe('20027131');
  });

  test('POST con catalog_item_id no recorre la marca y enlaza esa ficha', async () => {
    const itemQuery = queryChain({ data: { id: ITEM_ID }, error: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemQuery;
      throw new Error(`tabla inesperada: ${table}`);
    });

    const response = await request(app)
      .post('/api/admin/link-garage-refs-to-catalog')
      .set('Authorization', 'Bearer test-token')
      .send({
        garage_reference: '27131',
        catalog_item_id: ITEM_ID,
        garage_manufacturer: 'Carrera',
      });

    expect(response.status).toBe(200);
    expect(response.body.updated_count).toBe(2);
    expect(itemQuery.ilike).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'admin_link_vehicles_by_garage_ref_to_catalog_item',
      {
        p_garage_ref: '27131',
        p_garage_manufacturer: 'Carrera',
        p_catalog_item_id: ITEM_ID,
      },
    );
  });

  test('POST por referencia filtra en la consulta y acepta un alias', async () => {
    const itemsQuery = queryChain({ data: [], error: null });
    const aliasQuery = queryChain({
      data: [{ catalog_item_id: ITEM_ID, alias_reference: '27131' }],
      error: null,
    });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return itemsQuery;
      if (table === 'slot_catalog_item_aliases') return aliasQuery;
      throw new Error(`tabla inesperada: ${table}`);
    });

    const response = await request(app)
      .post('/api/admin/link-garage-refs-to-catalog')
      .set('Authorization', 'Bearer test-token')
      .send({
        garage_reference: '27131',
        catalog_reference: '27131',
        catalog_manufacturer_id: MFG_ID,
      });

    expect(response.status).toBe(200);
    expect(itemsQuery.ilike).toHaveBeenCalledWith('reference', '27131');
    expect(itemsQuery.eq).toHaveBeenCalledWith('manufacturer_id', MFG_ID);
    expect(aliasQuery.ilike).toHaveBeenCalledWith('alias_reference', '27131');
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'admin_link_vehicles_by_garage_ref_to_catalog_item',
      expect.objectContaining({ p_catalog_item_id: ITEM_ID, p_garage_ref: '27131' }),
    );
  });
});
