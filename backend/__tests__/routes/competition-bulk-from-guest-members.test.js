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

const ORGANIZER_ID = 'organizer-user-id';
const COMPETITION_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const CLUB_ID = 'club-1111-1111-4111-811111111111';
const GUEST_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_GUEST_ID = '77777777-7777-4777-8777-777777777777';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';

function createQueryBuilder(resolveValue = { data: null, error: null, count: 0 }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
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

const clubCompetition = {
  id: COMPETITION_ID,
  organizer: ORGANIZER_ID,
  club_id: CLUB_ID,
  status: 'published',
  num_slots: 10,
};

const competitionWithoutClub = {
  ...clubCompetition,
  club_id: null,
};

describe('POST /api/competitions/:id/participants/bulk-from-guest-members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: ORGANIZER_ID, email: 'org@test.com' } },
      error: null,
    });
  });

  test('rechaza competición sin club', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'competitions') {
        return createQueryBuilder({ data: competitionWithoutClub, error: null });
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .post(`/api/competitions/${COMPETITION_ID}/participants/bulk-from-guest-members`)
      .set('Authorization', 'Bearer org-token')
      .send({
        items: [
          {
            guest_member_id: GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Porsche 911',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/club/i);
  });

  test('rechaza guest de otro club', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'competitions') {
        return createQueryBuilder({ data: clubCompetition, error: null });
      }
      if (table === 'club_guest_members') {
        return createQueryBuilder({ data: [], error: null });
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .post(`/api/competitions/${COMPETITION_ID}/participants/bulk-from-guest-members`)
      .set('Authorization', 'Bearer org-token')
      .send({
        items: [
          {
            guest_member_id: GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Porsche 911',
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });

  test('añade guest con vehículo texto', async () => {
    const insertedRow = {
      id: 'participant-guest-1',
      competition_id: COMPETITION_ID,
      driver_name: 'Juan Sin Cuenta',
      category_id: CATEGORY_ID,
      vehicle_model: 'Porsche 911',
      from_guest_member_id: GUEST_ID,
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'competitions') {
        return createQueryBuilder({ data: clubCompetition, error: null });
      }
      if (table === 'club_guest_members') {
        return createQueryBuilder({
          data: [{ id: GUEST_ID, name: 'Juan Sin Cuenta', club_id: CLUB_ID, linked_user_id: null }],
          error: null,
        });
      }
      if (table === 'competition_categories') {
        return createQueryBuilder({ data: [{ id: CATEGORY_ID }], error: null });
      }
      if (table === 'competition_participants') {
        const builder = createQueryBuilder({ data: [], error: null, count: 0 });
        builder.maybeSingle.mockResolvedValue({ data: null, error: null });
        builder.insert.mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [insertedRow], error: null }),
        });
        return builder;
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .post(`/api/competitions/${COMPETITION_ID}/participants/bulk-from-guest-members`)
      .set('Authorization', 'Bearer org-token')
      .send({
        items: [
          {
            guest_member_id: GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Porsche 911',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.created[0].driver_name).toBe('Juan Sin Cuenta');
    expect(res.body.created[0].from_guest_member_id).toBe(GUEST_ID);
    expect(res.body.skipped).toHaveLength(0);
  });

  test('omite guest ya añadido', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'competitions') {
        return createQueryBuilder({ data: clubCompetition, error: null });
      }
      if (table === 'club_guest_members') {
        return createQueryBuilder({
          data: [{ id: GUEST_ID, name: 'Juan Sin Cuenta', club_id: CLUB_ID, linked_user_id: null }],
          error: null,
        });
      }
      if (table === 'competition_categories') {
        return createQueryBuilder({ data: [{ id: CATEGORY_ID }], error: null });
      }
      if (table === 'competition_participants') {
        const builder = createQueryBuilder({
          data: [{ id: 'existing', from_guest_member_id: GUEST_ID }],
          error: null,
          count: 1,
        });
        builder.maybeSingle.mockResolvedValue({ data: { start_order: 1 }, error: null });
        return builder;
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .post(`/api/competitions/${COMPETITION_ID}/participants/bulk-from-guest-members`)
      .set('Authorization', 'Bearer org-token')
      .send({
        items: [
          {
            guest_member_id: GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Porsche 911',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(0);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toMatch(/ya añadido/i);
  });

  test('rechaza si no quedan plazas', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'competitions') {
        return createQueryBuilder({ data: { ...clubCompetition, num_slots: 2 }, error: null });
      }
      if (table === 'club_guest_members') {
        return createQueryBuilder({
          data: [
            { id: GUEST_ID, name: 'Juan', club_id: CLUB_ID, linked_user_id: null },
            { id: OTHER_GUEST_ID, name: 'Pedro', club_id: CLUB_ID, linked_user_id: null },
          ],
          error: null,
        });
      }
      if (table === 'competition_categories') {
        return createQueryBuilder({ data: [{ id: CATEGORY_ID }], error: null });
      }
      if (table === 'competition_participants') {
        const builder = createQueryBuilder({ data: [], error: null, count: 2 });
        builder.maybeSingle.mockResolvedValue({ data: { start_order: 2 }, error: null });
        return builder;
      }
      return createQueryBuilder();
    });

    const res = await request(app)
      .post(`/api/competitions/${COMPETITION_ID}/participants/bulk-from-guest-members`)
      .set('Authorization', 'Bearer org-token')
      .send({
        items: [
          {
            guest_member_id: GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Coche A',
          },
          {
            guest_member_id: OTHER_GUEST_ID,
            category_id: CATEGORY_ID,
            vehicle_source: 'text',
            vehicle_model: 'Coche B',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/plazas/i);
  });
});
