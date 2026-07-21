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

function createQueryBuilder(resolveValue = { data: [], error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  builder.limit.mockImplementation(() => Promise.resolve(resolveValue));
  return builder;
}

describe('Onboarding Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  describe('GET /onboarding/status', () => {
    test('devuelve todo false cuando no hay datos', async () => {
      mockSupabase.from.mockImplementation(() => createQueryBuilder({ data: [], error: null }));

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasVehicle: false,
        hasCircuit: false,
        hasTiming: false,
        completed: false,
      });
    });

    test('devuelve solo hasVehicle cuando hay un vehículo', async () => {
      let fromCalls = 0;
      mockSupabase.from.mockImplementation((table) => {
        fromCalls += 1;
        if (table === 'vehicles' && fromCalls === 1) {
          return createQueryBuilder({ data: [{ id: 1 }], error: null });
        }
        return createQueryBuilder({ data: [], error: null });
      });

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasVehicle: true,
        hasCircuit: false,
        hasTiming: false,
        completed: false,
      });
    });

    test('devuelve completed true cuando hay vehículo, circuito y tiempo', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          return createQueryBuilder({ data: [{ id: 1 }], error: null });
        }
        if (table === 'circuits') {
          return createQueryBuilder({ data: [{ id: 'circuit-1' }], error: null });
        }
        if (table === 'vehicle_timings') {
          return createQueryBuilder({ data: [{ id: 10 }], error: null });
        }
        return createQueryBuilder({ data: [], error: null });
      });

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasVehicle: true,
        hasCircuit: true,
        hasTiming: true,
        completed: true,
      });
    });

    test('maneja errores de base de datos', async () => {
      mockSupabase.from.mockImplementation(() =>
        createQueryBuilder({ data: null, error: new Error('DB Error') }),
      );

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error al obtener estado de onboarding');
    });
  });
});
