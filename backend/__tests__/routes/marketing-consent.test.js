jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

const mockServiceClient = {
  from: jest.fn(),
};

jest.mock('../../lib/supabaseClients', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    getAnonClient: jest.fn(() => mockSupabase),
    getServiceClient: jest.fn(() => mockServiceClient),
    getServiceOrAnonClient: jest.fn(() => mockServiceClient),
    createUserScopedClient: jest.fn(() => mockSupabase),
    createServerClient: jest.fn(() => mockSupabase),
  };
});

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN = '11111111-1111-4111-8111-111111111111';

function chain(result, { upsertPayload } = {}) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    upsert: jest.fn((payload) => {
      if (upsertPayload) upsertPayload.value = payload;
      return builder;
    }),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('marketing consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com' } },
      error: null,
    });
  });

  test('GET sin fila devuelve consented false', async () => {
    mockServiceClient.from.mockReturnValue(chain({ data: null, error: null }));
    const res = await request(app)
      .get('/api/marketing-consent')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ consented: false, given_at: null, source: null }),
    );
  });

  test('PUT registra opt-in con source profile', async () => {
    const captured = {};
    mockServiceClient.from.mockImplementation(() =>
      chain(
        {
          data: {
            consented: true,
            given_at: '2026-11-12T10:00:00.000Z',
            withdrawn_at: null,
            source: 'profile',
            updated_at: '2026-11-12T10:00:00.000Z',
          },
          error: null,
        },
        { upsertPayload: captured },
      ),
    );
    const res = await request(app)
      .put('/api/marketing-consent')
      .set('Authorization', 'Bearer test-token')
      .send({ consented: true });
    expect(res.status).toBe(200);
    expect(res.body.consented).toBe(true);
    expect(captured.value).toEqual(
      expect.objectContaining({ user_id: USER_ID, consented: true, source: 'profile' }),
    );
  });

  test('baja pública por token sin sesión', async () => {
    mockServiceClient.from.mockImplementation(() =>
      chain({
        data: {
          user_id: USER_ID,
          consented: true,
          given_at: '2026-11-12T10:00:00.000Z',
          withdrawn_at: null,
          source: 'signup',
          updated_at: '2026-11-12T10:00:00.000Z',
        },
        error: null,
      }),
    );
    const res = await request(app)
      .get('/api/public/marketing-consent/unsubscribe')
      .query({ token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.consented).toBe(true);
  });

  test('PUT rechaza consented no boolean', async () => {
    const res = await request(app)
      .put('/api/marketing-consent')
      .set('Authorization', 'Bearer test-token')
      .send({ consented: 'yes' });
    expect(res.status).toBe(400);
  });
});
