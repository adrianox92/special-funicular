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

const ADMIN_ID = '88888888-8888-4888-8888-888888888888';
const MEMBER_ID = '99999999-9999-4999-8999-999999999999';
const CLUB_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_MEMBERSHIP_ID = '12121212-1212-4121-8121-121212121212';
const MEMBER_MEMBERSHIP_ID = '13131313-1313-4131-8131-131313131313';
const API_KEY = 'sc_test_fixture_not_a_secret';

function createQueryBuilder(resolveValue = { data: null, error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolveValue),
    single: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function installAuthAdmin(getUserById) {
  mockSupabase.auth.admin = {
    getUserById: getUserById || jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };
}

describe('GET /api/sync/clubs/:id/members (D10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installAuthAdmin();
  });

  test('401 without X-API-Key', async () => {
    const res = await request(app).get(`/api/sync/clubs/${CLUB_ID}/members`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/X-API-Key/);
  });

  test('403 when the key user is not club admin/owner', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'user_api_keys') {
        return createQueryBuilder({ data: { user_id: MEMBER_ID }, error: null });
      }
      if (table === 'clubs') {
        return createQueryBuilder({ data: null, error: null });
      }
      if (table === 'club_members') {
        return createQueryBuilder({ data: null, error: null });
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .get(`/api/sync/clubs/${CLUB_ID}/members`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Sin permiso' });
  });

  test('200 happy path includes user_id, display_name, email, role', async () => {
    installAuthAdmin(
      jest.fn(async (userId) => ({
        data: {
          user: {
            id: userId,
            email: userId === ADMIN_ID ? 'ada@example.test' : 'bob@example.test',
            user_metadata: { name: userId === ADMIN_ID ? 'Ada' : 'Bob' },
          },
        },
        error: null,
      })),
    );

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'user_api_keys') {
        return createQueryBuilder({ data: { user_id: ADMIN_ID }, error: null });
      }
      if (table === 'clubs') {
        return createQueryBuilder({
          data: { id: CLUB_ID, owner_user_id: ADMIN_ID },
          error: null,
        });
      }
      if (table === 'club_members') {
        return createQueryBuilder({
          data: [
            {
              id: ADMIN_MEMBERSHIP_ID,
              user_id: ADMIN_ID,
              role: 'admin',
              joined_at: '2026-01-15T10:00:00.000Z',
            },
            {
              id: MEMBER_MEMBERSHIP_ID,
              user_id: MEMBER_ID,
              role: 'member',
              joined_at: '2026-02-01T10:00:00.000Z',
            },
          ],
          error: null,
        });
      }
      if (table === 'pilot_public_profiles') {
        return createQueryBuilder({
          data: [{ user_id: ADMIN_ID, display_name: 'Ada Lovelace' }],
          error: null,
        });
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .get(`/api/sync/clubs/${CLUB_ID}/members`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.owner_user_id).toBe(ADMIN_ID);
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(res.body.members[0]).toEqual(
      expect.objectContaining({
        user_id: ADMIN_ID,
        display_name: 'Ada Lovelace',
        email: 'ada@example.test',
        role: 'admin',
        is_owner: true,
      }),
    );
    expect(res.body.members[1]).toEqual(
      expect.objectContaining({
        user_id: MEMBER_ID,
        display_name: 'Bob',
        email: 'bob@example.test',
        role: 'member',
        is_owner: false,
      }),
    );
  });

  test('does not shadow GET /guest-members', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'user_api_keys') {
        return createQueryBuilder({ data: { user_id: ADMIN_ID }, error: null });
      }
      if (table === 'clubs') {
        return createQueryBuilder({
          data: { id: CLUB_ID, owner_user_id: ADMIN_ID },
          error: null,
        });
      }
      if (table === 'club_members') {
        return createQueryBuilder({ data: { role: 'admin' }, error: null });
      }
      if (table === 'club_guest_members') {
        return createQueryBuilder({
          data: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              club_id: CLUB_ID,
              name: 'Invitado',
              email: 'guest@example.test',
              linked_user_id: null,
              created_at: '2026-09-01T10:00:00.000Z',
            },
          ],
          error: null,
        });
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .get(`/api/sync/clubs/${CLUB_ID}/guest-members`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.guest_members).toEqual([
      expect.objectContaining({
        name: 'Invitado',
        linked_user_email: null,
      }),
    ]);
    expect(res.body.members).toBeUndefined();
  });
});
