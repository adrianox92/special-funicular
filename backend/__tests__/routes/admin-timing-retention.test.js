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

function createPagedBuilder(rows) {
  const builder = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('GET /api/admin/timing-retention', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: ADMIN_EMAIL } },
      error: null,
    });
    mockSupabase.auth.admin = {
      listUsers: jest.fn().mockResolvedValue({
        data: { users: [{ id: 'u-1' }, { id: 'u-2' }] },
        error: null,
      }),
    };
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
      .get('/api/admin/timing-retention')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/administradores/i);
  });

  test('503 si falta el cliente service-role', async () => {
    getServiceClient.mockReturnValueOnce(null);

    const response = await request(app)
      .get('/api/admin/timing-retention')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(503);
  });

  test('devuelve el KPI timing-30d con la definición SQL (join + coalesce)', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'vehicles') {
        return createPagedBuilder([{ id: 'v-1', user_id: 'u-1' }]);
      }
      if (table === 'vehicle_timings') {
        return createPagedBuilder([
          {
            vehicle_id: 'v-1',
            timing_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return createPagedBuilder([]);
    });

    const response = await request(app)
      .get('/api/admin/timing-retention')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.window_days).toBe(30);
    expect(response.body.registered_users).toBe(2);
    expect(response.body.users_with_vehicle).toBe(1);
    expect(response.body.users_with_timing_30d).toBe(1);
    expect(response.body.timing_30d_pct).toBe(50);
    expect(response.body.goal.target_min_pct).toBe(8);
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicle_timings');
    expect(mockSupabase.auth.admin.listUsers).toHaveBeenCalled();
  });
});
