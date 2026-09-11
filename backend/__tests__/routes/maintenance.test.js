const fs = require('fs');
const path = require('path');

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
const { createUserScopedClient } = require('../../lib/supabaseClients');

function createQueryBuilder(resolveValue = { data: [], error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolveValue),
    single: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('maintenance routes usan cliente con JWT', () => {
  test('el módulo no usa getAnonClient para datos de usuario', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../routes/maintenance.js'), 'utf8');
    expect(src).not.toMatch(/getAnonClient/);
    expect(src).toMatch(/createUserScopedClient/);
    expect(src).toMatch(/req\.supabase/);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  test('GET /api/maintenance crea cliente user-scoped con el Authorization header', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'vehicles') {
        return createQueryBuilder({ data: { id: 'veh-1' }, error: null });
      }
      return createQueryBuilder({ data: [], error: null });
    });

    const response = await request(app)
      .get('/api/maintenance?vehicle_id=veh-1')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicle_maintenance_log');
  });

  test('POST /api/maintenance inserta con el cliente user-scoped', async () => {
    const created = {
      id: 'log-1',
      user_id: 'test-user-id',
      vehicle_id: 'veh-1',
      performed_at: '2026-09-11',
      kind: 'engrase',
    };
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'vehicles') {
        return createQueryBuilder({ data: { id: 'veh-1' }, error: null });
      }
      return createQueryBuilder({ data: created, error: null });
    });

    const response = await request(app)
      .post('/api/maintenance')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicle_id: 'veh-1',
        performed_at: '2026-09-11',
        kind: 'engrase',
      });

    expect(response.status).toBe(201);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicle_maintenance_log');
  });
});
