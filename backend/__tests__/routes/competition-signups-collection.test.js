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

const MEMBER_ID = 'member-user-id';
const ORGANIZER_ID = 'organizer-user-id';
const OTHER_USER_ID = 'other-user-id';
const COMPETITION_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const SIGNUP_ID = '55555555-5555-4555-8555-555555555555';
const PUBLIC_SLUG = 'test-competition-slug';
const AUTH_HEADER = { Authorization: 'Bearer test-token' };

function createQueryBuilder(resolveValue = { data: null, error: null, count: 0 }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    maybeSingle: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  builder.select.mockImplementation((_, opts) => {
    if (opts?.count === 'exact') {
      builder.then = (onFulfilled, onRejected) =>
        Promise.resolve({ count: resolveValue.count ?? 0, error: resolveValue.error ?? null }).then(
          onFulfilled,
          onRejected,
        );
    }
    return builder;
  });
  return builder;
}

const publishedCompetition = {
  id: COMPETITION_ID,
  organizer: ORGANIZER_ID,
  club_id: 'club-1',
  status: 'published',
  num_slots: 10,
  registration_deadline: null,
};

describe('Inscripción con coches de colección', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: MEMBER_ID,
          email: 'member@test.com',
          user_metadata: { full_name: 'Miembro Test' },
        },
      },
      error: null,
    });
  });

  describe('POST /api/competitions/:id/signups (miembro del club)', () => {
    test('acepta vehicle_id de la colección del miembro', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({ data: publishedCompetition, error: null });
        }
        if (table === 'competition_categories') {
          return createQueryBuilder({ data: { id: CATEGORY_ID }, error: null });
        }
        if (table === 'vehicles') {
          return createQueryBuilder({
            data: {
              id: VEHICLE_ID,
              manufacturer: 'Scalextric',
              model: 'Ferrari',
              user_id: MEMBER_ID,
            },
            error: null,
          });
        }
        if (table === 'competition_participants') {
          return createQueryBuilder({ count: 2, error: null });
        }
        if (table === 'competition_signups') {
          const builder = createQueryBuilder({ data: null, error: null });
          builder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: SIGNUP_ID,
                  name: 'Miembro Test',
                  email: 'member@test.com',
                  vehicle: 'Scalextric Ferrari',
                  vehicle_id: VEHICLE_ID,
                  is_waitlist: false,
                  waitlist_position: null,
                  competition_categories: { name: 'General' },
                  vehicles: { id: VEHICLE_ID, model: 'Ferrari', manufacturer: 'Scalextric', type: 'GT' },
                },
                error: null,
              }),
            }),
          });
          return builder;
        }
        if (table === 'club_members') {
          return createQueryBuilder({ data: { id: 'mem-1' }, error: null });
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post(`/api/competitions/${COMPETITION_ID}/signups`)
        .set(AUTH_HEADER)
        .send({ category_id: CATEGORY_ID, vehicle_id: VEHICLE_ID });

      expect(res.status).toBe(201);
      expect(res.body.signup.vehicle_id).toBe(VEHICLE_ID);
      expect(res.body.signup.vehicle).toContain('Ferrari');
    });

    test('acepta vehículo en texto libre', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({ data: publishedCompetition, error: null });
        }
        if (table === 'competition_categories') {
          return createQueryBuilder({ data: { id: CATEGORY_ID }, error: null });
        }
        if (table === 'competition_participants') {
          return createQueryBuilder({ count: 2, error: null });
        }
        if (table === 'competition_signups') {
          const builder = createQueryBuilder({ data: null, error: null });
          builder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: SIGNUP_ID,
                  name: 'Miembro Test',
                  email: 'member@test.com',
                  vehicle: 'Carrera Porsche 911',
                  vehicle_id: null,
                  is_waitlist: false,
                  waitlist_position: null,
                  competition_categories: { name: 'General' },
                  vehicles: null,
                },
                error: null,
              }),
            }),
          });
          return builder;
        }
        if (table === 'club_members') {
          return createQueryBuilder({ data: { id: 'mem-1' }, error: null });
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post(`/api/competitions/${COMPETITION_ID}/signups`)
        .set(AUTH_HEADER)
        .send({ category_id: CATEGORY_ID, vehicle: 'Carrera Porsche 911' });

      expect(res.status).toBe(201);
      expect(res.body.signup.vehicle_id).toBeNull();
      expect(res.body.signup.vehicle).toBe('Carrera Porsche 911');
    });

    test('rechaza vehicle_id de otro usuario con 403', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({ data: publishedCompetition, error: null });
        }
        if (table === 'competition_categories') {
          return createQueryBuilder({ data: { id: CATEGORY_ID }, error: null });
        }
        if (table === 'vehicles') {
          return createQueryBuilder({
            data: {
              id: OTHER_VEHICLE_ID,
              manufacturer: 'Carrera',
              model: 'Porsche',
              user_id: OTHER_USER_ID,
            },
            error: null,
          });
        }
        if (table === 'club_members') {
          return createQueryBuilder({ data: { id: 'mem-1' }, error: null });
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post(`/api/competitions/${COMPETITION_ID}/signups`)
        .set(AUTH_HEADER)
        .send({ category_id: CATEGORY_ID, vehicle_id: OTHER_VEHICLE_ID });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/propia colección/i);
    });
  });

  describe('POST /api/public-signup/:slug/signup (enlace público)', () => {
    test('usuario logueado puede inscribirse con vehicle_id', async () => {
      let categoryListCalls = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({
            data: { ...publishedCompetition, public_slug: PUBLIC_SLUG },
            error: null,
          });
        }
        if (table === 'competition_categories') {
          categoryListCalls += 1;
          if (categoryListCalls === 1) {
            const builder = createQueryBuilder();
            builder.then = (onFulfilled, onRejected) =>
              Promise.resolve({ data: [{ id: CATEGORY_ID }], error: null }).then(onFulfilled, onRejected);
            return builder;
          }
          return createQueryBuilder({
            data: { id: CATEGORY_ID, name: 'General' },
            error: null,
          });
        }
        if (table === 'vehicles') {
          return createQueryBuilder({
            data: {
              id: VEHICLE_ID,
              manufacturer: 'Scalextric',
              model: 'McLaren',
              user_id: MEMBER_ID,
            },
            error: null,
          });
        }
        if (table === 'competition_participants') {
          return createQueryBuilder({ count: 1, error: null });
        }
        if (table === 'competition_signups') {
          const builder = createQueryBuilder({ data: null, error: null });
          builder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: SIGNUP_ID,
                  name: 'Miembro Test',
                  email: 'member@test.com',
                  vehicle: 'Scalextric McLaren',
                  vehicle_id: VEHICLE_ID,
                  is_waitlist: false,
                  waitlist_position: null,
                  competition_categories: { name: 'General' },
                },
                error: null,
              }),
            }),
          });
          return builder;
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post(`/api/public-signup/${PUBLIC_SLUG}/signup`)
        .set(AUTH_HEADER)
        .send({
          name: 'Miembro Test',
          email: 'member@test.com',
          category_id: CATEGORY_ID,
          vehicle_id: VEHICLE_ID,
        });

      expect(res.status).toBe(201);
      expect(res.body.signup.vehicle_id).toBe(VEHICLE_ID);
    });

    test('sin sesión solo acepta texto libre', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({
            data: { ...publishedCompetition, public_slug: PUBLIC_SLUG },
            error: null,
          });
        }
        if (table === 'competition_categories') {
          const builder = createQueryBuilder();
          builder.then = (onFulfilled, onRejected) =>
            Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
          return builder;
        }
        if (table === 'competition_participants') {
          return createQueryBuilder({ count: 0, error: null });
        }
        if (table === 'competition_signups') {
          const builder = createQueryBuilder({ data: null, error: null });
          builder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: SIGNUP_ID,
                  name: 'Anónimo',
                  email: 'anon@test.com',
                  vehicle: 'Scalextric Ford GT',
                  vehicle_id: null,
                  is_waitlist: false,
                  waitlist_position: null,
                  competition_categories: null,
                },
                error: null,
              }),
            }),
          });
          return builder;
        }
        return createQueryBuilder();
      });

      const res = await request(app).post(`/api/public-signup/${PUBLIC_SLUG}/signup`).send({
        name: 'Anónimo',
        email: 'anon@test.com',
        vehicle: 'Scalextric Ford GT',
      });

      expect(res.status).toBe(201);
      expect(res.body.signup.vehicle_id).toBeNull();
      expect(res.body.signup.vehicle).toBe('Scalextric Ford GT');
    });

    test('sin sesión rechaza vehicle_id con 401', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({
            data: { ...publishedCompetition, public_slug: PUBLIC_SLUG },
            error: null,
          });
        }
        if (table === 'competition_categories') {
          const builder = createQueryBuilder();
          builder.then = (onFulfilled, onRejected) =>
            Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
          return builder;
        }
        return createQueryBuilder();
      });

      const res = await request(app).post(`/api/public-signup/${PUBLIC_SLUG}/signup`).send({
        name: 'Anónimo',
        email: 'anon@test.com',
        vehicle_id: VEHICLE_ID,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/iniciar sesión/i);
    });
  });

  describe('POST /api/competitions/:id/signups/:signupId/approve', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: ORGANIZER_ID, email: 'org@test.com' } },
        error: null,
      });
    });

    test('conserva vehicle_id del miembro al aprobar sin override', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competitions') {
          return createQueryBuilder({ data: publishedCompetition, error: null });
        }
        if (table === 'competition_signups') {
          const builder = createQueryBuilder({
            data: {
              id: SIGNUP_ID,
              name: 'Miembro Test',
              email: 'member@test.com',
              vehicle: 'Scalextric Ferrari',
              vehicle_id: VEHICLE_ID,
              category_id: CATEGORY_ID,
              is_waitlist: false,
            },
            error: null,
          });
          builder.delete.mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          });
          return builder;
        }
        if (table === 'competition_participants') {
          const builder = createQueryBuilder({ count: 2, error: null });
          builder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'participant-1',
                  competition_id: COMPETITION_ID,
                  driver_name: 'Miembro Test',
                  vehicle_id: VEHICLE_ID,
                  category_id: CATEGORY_ID,
                },
                error: null,
              }),
            }),
          });
          return builder;
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post(`/api/competitions/${COMPETITION_ID}/signups/${SIGNUP_ID}/approve`)
        .set({ Authorization: 'Bearer org-token' })
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.vehicle_id).toBe(VEHICLE_ID);
    });
  });
});
