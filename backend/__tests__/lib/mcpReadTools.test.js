'use strict';

jest.mock('../../lib/supabaseClients', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('../../lib/competitionProgress', () => ({
  buildCompetitionProgress: jest.fn(async () => ({
    participants_count: 1,
    rounds: 1,
    times_by_round: { 1: [{ id: 't' }] },
    category_rankings: [{ sortedParticipants: [{ id: 'p1' }, { id: 'p2' }] }],
  })),
}));

const { getServiceClient } = require('../../lib/supabaseClients');
const { listVehicles, searchCatalog, getVehicle, listTimings } = require('../../lib/mcpReadTools');

const USER = 'user-a';
const OTHER = 'user-b';

function builder(result) {
  const b = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    ilike: jest.fn(() => b),
    in: jest.fn(() => b),
    neq: jest.fn(() => b),
    gte: jest.fn(() => b),
    lte: jest.fn(() => b),
    order: jest.fn(() => b),
    limit: jest.fn(() => b),
    range: jest.fn(() => b),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return b;
}

describe('mcpReadTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('list_vehicles filtra por el usuario del token, no por un user_id del argumento', async () => {
    const vehicles = builder({ data: [{ id: 'v1', model: 'Porsche' }], error: null, count: 1 });
    getServiceClient.mockReturnValue({
      from: jest.fn(() => vehicles),
    });
    const body = await listVehicles(USER, { user_id: OTHER, page: 1, limit: 10 });
    expect(body.vehicles).toHaveLength(1);
    expect(vehicles.eq).toHaveBeenCalledWith('user_id', USER);
    expect(vehicles.eq).not.toHaveBeenCalledWith('user_id', OTHER);
  });

  test('get_vehicle no devuelve un coche de otra cuenta', async () => {
    const vehicles = builder({ data: null, error: null });
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => (table === 'vehicles' ? vehicles : builder({ data: [], error: null }))),
    });
    await expect(getVehicle(USER, { id: '11111111-1111-4111-8111-111111111111', user_id: OTHER }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(vehicles.eq).toHaveBeenCalledWith('user_id', USER);
  });

  test('list_timings exige que el vehículo sea del usuario', async () => {
    const vehicles = builder({ data: null, error: null });
    getServiceClient.mockReturnValue({ from: jest.fn(() => vehicles) });
    await expect(listTimings(USER, { vehicle_id: '22222222-2222-4222-8222-222222222222' }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Vehículo no encontrado' });
    expect(vehicles.eq).toHaveBeenCalledWith('user_id', USER);
  });

  test('el catálogo sigue exigiendo sesión', async () => {
    await expect(searchCatalog('', { q: 'ferrari' })).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });
});
