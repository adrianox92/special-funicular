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

jest.mock('../../lib/vehicleTimingInsert', () => ({
  insertVehicleTimingFromSyncBody: jest.fn(),
}));

jest.mock('../../lib/notifier', () => ({
  sendTimingNotification: jest.fn().mockResolvedValue(undefined),
  sendTestNotification: jest.fn(),
  sendCompetitionLiveNotification: jest.fn(),
  sendWeeklyDigestNotification: jest.fn(),
  fetchUserMetadata: jest.fn(),
}));

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');
const { insertVehicleTimingFromSyncBody } = require('../../lib/vehicleTimingInsert');
const { sendTimingNotification } = require('../../lib/notifier');

describe('POST /api/timings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  test('reutiliza insertVehicleTimingFromSyncBody y no inventa otro insert', async () => {
    insertVehicleTimingFromSyncBody.mockResolvedValue({
      success: true,
      finalTiming: {
        id: 'timing-1',
        vehicle_id: 'veh-1',
        session_type: 'TRAINING',
        best_lap_time: '00:11.324',
      },
      previousBestLapSeconds: 11.5,
      syncMeta: {
        previous_best_lap_seconds: 11.5,
        delta_vs_pb_seconds: -0.176,
        is_personal_best: true,
      },
    });

    const body = {
      vehicle_id: 'veh-1',
      best_lap_time: '00:11.324',
      total_time: '02:00.000',
      laps: 10,
      average_time: '00:12.000',
      circuit_id: 'cir-1',
      session_type: 'TRAINING',
    };

    const response = await request(app)
      .post('/api/timings')
      .set('Authorization', 'Bearer test-token')
      .send(body);

    expect(response.status).toBe(201);
    expect(insertVehicleTimingFromSyncBody).toHaveBeenCalledTimes(1);
    expect(insertVehicleTimingFromSyncBody.mock.calls[0][1]).toBe('test-user-id');
    expect(insertVehicleTimingFromSyncBody.mock.calls[0][2]).toMatchObject(body);
    expect(response.body.session_type).toBe('TRAINING');
    expect(response.body.sync_meta.is_personal_best).toBe(true);
    expect(sendTimingNotification).toHaveBeenCalled();
  });

  test('propaga errores de validación del insert compartido', async () => {
    insertVehicleTimingFromSyncBody.mockResolvedValue({
      success: false,
      status: 400,
      error: 'Campos requeridos: vehicle_id, best_lap_time, total_time, laps, average_time',
    });

    const response = await request(app)
      .post('/api/timings')
      .set('Authorization', 'Bearer test-token')
      .send({ vehicle_id: 'veh-1' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Campos requeridos/);
  });
});
