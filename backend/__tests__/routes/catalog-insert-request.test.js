jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

const mockServiceClient = {
  from: jest.fn(),
};

const mockUserClient = {
  from: jest.fn(),
};

jest.mock('../../lib/supabaseClients', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    getAnonClient: jest.fn(() => mockSupabase),
    getServiceClient: jest.fn(() => mockServiceClient),
    getServiceOrAnonClient: jest.fn(() => mockServiceClient),
    createUserScopedClient: jest.fn(() => mockUserClient),
    createServerClient: jest.fn(() => mockSupabase),
  };
});

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MFG_ID = '22222222-2222-4222-8222-222222222222';

function chain(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('POST /api/catalog/insert-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'pilot@example.com' } },
      error: null,
    });
  });

  test('inserta el alta con service_role y submitted_by del usuario', async () => {
    const items = chain({ data: null, error: null });
    const inserted = {
      id: '33333333-3333-4333-8333-333333333333',
      proposed_reference: 'SCX-1',
      proposed_manufacturer_id: MFG_ID,
      proposed_model_name: 'Audi',
      status: 'pending',
      submitted_by: USER_ID,
    };
    const requests = chain({ data: inserted, error: null });
    const brands = chain({ data: [{ id: MFG_ID, name: 'Scalextric' }], error: null });

    mockServiceClient.from.mockImplementation((table) => {
      if (table === 'slot_catalog_items') return items;
      if (table === 'slot_catalog_insert_requests') return requests;
      if (table === 'slot_catalog_brands') return brands;
      return chain({ data: null, error: null });
    });
    mockUserClient.from.mockImplementation(() => {
      throw new Error('el alta no debe usar el cliente JWT');
    });

    const response = await request(app)
      .post('/api/catalog/insert-requests')
      .set('Authorization', 'Bearer test-token')
      .field('proposed_reference', 'scx-1')
      .field('proposed_manufacturer_id', MFG_ID)
      .field('proposed_model_name', 'Audi');

    expect(response.status).toBe(201);
    expect(requests.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        proposed_reference: 'SCX-1',
        proposed_manufacturer_id: MFG_ID,
        proposed_model_name: 'Audi',
        submitted_by: USER_ID,
        status: 'pending',
      }),
    ]);
    expect(mockUserClient.from).not.toHaveBeenCalled();
    expect(response.body.proposed_manufacturer).toBe('Scalextric');
  });
});
