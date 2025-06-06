const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../app');
const { mockSupabase } = require('../mocks/supabase');

// Mock de Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Dashboard Routes', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset de los mocks antes de cada test
    jest.clearAllMocks();
    mockReq = { user: { id: 'test-user-id' } };
    mockRes = { json: jest.fn(), status: jest.fn(() => mockRes) };
  });

  describe('GET /dashboard/metrics', () => {
    test('devuelve métricas correctamente', async () => {
      // Mock de datos de vehículos
      const mockVehicles = [
        { id: 1, type: 'Hot Wheels', modified: true, price: 100, total_price: 150 },
        { id: 2, type: 'Hot Wheels', modified: false, price: 100, total_price: 100 },
        { id: 3, type: 'Matchbox', modified: true, price: 200, total_price: 300 }
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

      // Configurar mocks de Supabase
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockVehicles, error: null })
          };
        }
        if (table === 'vehicle_timings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockTimings, error: null })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      const response = await request(app)
        .get('/dashboard/metrics')
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
    });

    test('maneja errores de base de datos correctamente', async () => {
      // Simular error en la consulta de vehículos
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
      }));

      const response = await request(app)
        .get('/dashboard/metrics')
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
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'vehicles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockVehiclesByType, error: null })
          };
        }
        if (table === 'technical_specs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockComponents, error: null })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      const response = await request(app)
        .get('/dashboard/charts')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vehiclesByType');
      expect(response.body).toHaveProperty('modificationStats');
      expect(response.body).toHaveProperty('topCostVehicles');
      expect(response.body).toHaveProperty('topComponents');
      expect(response.body).toHaveProperty('performanceByType');
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
        .get('/dashboard/charts')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error al obtener datos de gráficos');
    });
  });
}); 