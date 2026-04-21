jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

/** Misma API que usa el código real vía backend/lib/supabaseClients.js */
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

/** Builder thenable compatible con cadenas típicas de Supabase en dashboard. */
function createQueryBuilder(resolveValue = { data: [], error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('Dashboard Routes', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset de los mocks antes de cada test
    jest.clearAllMocks();
    mockReq = { user: { id: 'test-user-id' } };
    mockRes = { json: jest.fn(), status: jest.fn(() => mockRes) };
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  describe('GET /dashboard/metrics', () => {
    test('devuelve métricas correctamente', async () => {
      // Mock de datos de vehículos
      const mockVehicles = [
        {
          id: 1,
          type: 'Hot Wheels',
          modified: true,
          price: 100,
          total_price: 150,
          digital: true,
          museo: true,
          taller: false,
        },
        {
          id: 2,
          type: 'Hot Wheels',
          modified: false,
          price: 100,
          total_price: 100,
          digital: false,
          museo: false,
          taller: false,
        },
        {
          id: 3,
          type: 'Matchbox',
          modified: true,
          price: 200,
          total_price: 300,
          digital: true,
          museo: false,
          taller: true,
        },
      ];

      // Mock de datos de tiempos
      const mockTimings = [
        {
          id: 1,
          best_lap_time: 90.5,
          timing_date: '2024-03-07',
          circuit: 'Test Circuit',
          laps: 5,
          lane: 'A',
          vehicles: { id: 1, model: 'Test Model', manufacturer: 'Test Manufacturer' }
        }
      ];

      let vehicleTimingsCall = 0;

      // Configurar mocks de Supabase
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          const b = createQueryBuilder();
          b.eq.mockReturnThis();
          b.limit.mockImplementation(() => Promise.resolve({ data: mockVehicles, error: null }));
          return b;
        }
        if (table === 'vehicle_timings') {
          vehicleTimingsCall += 1;
          const b = createQueryBuilder();
          if (vehicleTimingsCall === 1) {
            b.single.mockResolvedValue({ data: mockTimings[0], error: null });
          } else if (vehicleTimingsCall === 2) {
            b.gte.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          } else if (vehicleTimingsCall === 3) {
            b.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
          }
          return b;
        }
        if (table === 'competitions' || table === 'competition_participants' || table === 'competition_timings') {
          return createQueryBuilder();
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalVehicles', 3);
      expect(response.body).toHaveProperty('modifiedVehicles', 2);
      expect(response.body).toHaveProperty('stockVehicles', 1);
      expect(response.body).toHaveProperty('totalInvestment');
      expect(response.body).toHaveProperty('averageInvestmentPerVehicle');
      expect(response.body).toHaveProperty('averagePriceIncrement');
      expect(response.body).toHaveProperty('lastUpdate');
      expect(response.body).toHaveProperty('highestIncrementVehicle');
      expect(response.body).toHaveProperty('bestTimeVehicle');
      expect(response.body).toHaveProperty('activeCompetitions', 0);
      expect(response.body).toHaveProperty('digitalVehicles', 2);
      expect(response.body).toHaveProperty('museoVehicles', 1);
      expect(response.body).toHaveProperty('tallerVehicles', 1);
    });

    test('maneja errores de base de datos correctamente', async () => {
      // Simular error en la consulta de vehículos (.eq().limit() como en dashboard/metrics)
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
      }));

      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error al obtener métricas del dashboard');
    });
  });

  describe('GET /dashboard/charts', () => {
    test('devuelve datos de gráficos correctamente', async () => {
      // Mock de datos para gráficos
      const mockVehiclesByType = [
        { type: 'Hot Wheels', modified: true },
        { type: 'Hot Wheels', modified: false },
        { type: 'Matchbox', modified: true }
      ];

      const mockComponents = [
        {
          id: 1,
          is_modification: true,
          components: [
            { id: 1, element: 'Test Component', sku: 'SKU1', price: 100, component_type: 'Type1' }
          ],
          vehicles: { id: 1, model: 'Test Model', manufacturer: 'Test Manufacturer' }
        }
      ];

      // Configurar mocks de Supabase
      let vehiclesFromCalls = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          vehiclesFromCalls += 1;
          const b = createQueryBuilder();
          if (vehiclesFromCalls === 1) {
            b.eq.mockImplementation(() => Promise.resolve({ data: mockVehiclesByType, error: null }));
          } else if (vehiclesFromCalls === 2) {
            b.eq.mockReturnThis();
            b.gt.mockReturnThis();
            b.order.mockReturnThis();
            b.limit.mockImplementation(() =>
              Promise.resolve({
                data: [
                  {
                    id: 1,
                    model: 'Test Model',
                    manufacturer: 'Test Manufacturer',
                    price: 50,
                    total_price: 100,
                  },
                ],
                error: null,
              }),
            );
          } else {
            b.eq.mockImplementation(() => Promise.resolve({ data: mockVehiclesByType, error: null }));
          }
          return b;
        }
        if (table === 'vehicle_timings') {
          const b = createQueryBuilder();
          b.eq.mockReturnThis();
          b.order.mockReturnThis();
          b.limit.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return b;
        }
        if (table === 'technical_specs') {
          const b = createQueryBuilder();
          let specEq = 0;
          b.eq.mockImplementation(() => {
            specEq += 1;
            if (specEq >= 2) {
              return Promise.resolve({ data: mockComponents, error: null });
            }
            return b;
          });
          return b;
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .get('/api/dashboard/charts')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vehiclesByType');
      expect(response.body).toHaveProperty('modificationStats');
      expect(response.body).toHaveProperty('topCostVehicles');
      expect(response.body).toHaveProperty('topComponents');
      expect(response.body).toHaveProperty('brandDistribution');
      expect(response.body).toHaveProperty('storeDistribution');
    });

    test('maneja errores de base de datos correctamente', async () => {
      // Simular error en la consulta
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
      }));

      const response = await request(app)
        .get('/api/dashboard/charts')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error al obtener datos de gráficos');
    });
  });

  describe('GET /dashboard/action-items', () => {
    test('devuelve estructura accionable con listas vacías', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          const b = createQueryBuilder();
          b.eq.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return b;
        }
        if (table === 'competitions' || table === 'competition_participants' || table === 'competition_timings') {
          return createQueryBuilder();
        }
        if (table === 'vehicle_timings') {
          return createQueryBuilder();
        }
        if (table === 'inventory_items') {
          const b = createQueryBuilder();
          b.eq.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return b;
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .get('/api/dashboard/action-items')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        nextCompetition: null,
        openCompetitionTimings: [],
        usualCircuit: null,
        staleVehiclesAtUsualCircuit: [],
        lowStockCritical: [],
      });
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('staleDaysThreshold', 60);
    });

    test('action-items usa staleDaysThreshold desde user_metadata', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            user_metadata: { stale_days_threshold: 45 },
          },
        },
        error: null,
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          const b = createQueryBuilder();
          b.eq.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return b;
        }
        if (table === 'competitions' || table === 'competition_participants' || table === 'competition_timings') {
          return createQueryBuilder();
        }
        if (table === 'vehicle_timings') {
          return createQueryBuilder();
        }
        if (table === 'inventory_items') {
          const b = createQueryBuilder();
          b.eq.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return b;
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .get('/api/dashboard/action-items')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('staleDaysThreshold', 45);
    });
  });
}); 