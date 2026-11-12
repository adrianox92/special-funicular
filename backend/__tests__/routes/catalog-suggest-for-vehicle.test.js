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

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

function thenable(result) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    or: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
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

describe('GET /api/catalog/suggest-for-vehicle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
  });

  test('devuelve coincidencias agrupadas por variante', async () => {
    const items = [
      {
        id: ITEM_ID,
        reference: '0135AW',
        manufacturer: 'NSR',
        model_name: 'Audi R8 LMS AW',
        traction: '4x4',
        image_url: null,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        reference: '0135SW',
        manufacturer: 'NSR',
        model_name: 'Audi R8 LMS SW',
        traction: 'Trasera',
        image_url: null,
      },
    ];
    const empty = thenable({ data: [], error: null });
    const found = thenable({ data: items, error: null });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'slot_catalog_item_aliases') return empty;
      if (table === 'slot_catalog_items_with_ratings') return found;
      return empty;
    });

    const res = await request(app)
      .get('/api/catalog/suggest-for-vehicle')
      .query({ manufacturer: 'NSR', model: 'Audi R8 LMS', reference: '' })
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.groups.some((g) => g.variant_group)).toBe(true);
  });

  test('sin query suficiente no consulta y no bloquea', async () => {
    const res = await request(app)
      .get('/api/catalog/suggest-for-vehicle')
      .query({ manufacturer: 'NSR' })
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
