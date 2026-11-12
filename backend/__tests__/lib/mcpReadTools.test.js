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
const { listVehicles, getCatalogItem, getVehicle, listTimings, resetCatalogLookupLimit } = require('../../lib/mcpReadTools');

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
    gte: jest.fn(() => b),
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
    resetCatalogLookupLimit();
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

  test('el catálogo exige sesión y no se consulta sin usuario', async () => {
    await expect(getCatalogItem('', { reference: '50402', manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  test('una referencia ambigua no devuelve el listado', async () => {
    const items = builder({ data: [{ id: 'item-a' }, { id: 'item-b' }], error: null });
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table === 'slot_catalog_brands') {
          return builder({ data: [{ id: 'brand-1' }], error: null });
        }
        return items;
      }),
    });
    await expect(getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(items.eq).toHaveBeenCalledWith('reference', '50402');
  });

  test('devuelve una sola ficha y no su identificador interno', async () => {
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table === 'slot_catalog_brands') return builder({ data: [{ id: 'brand-1' }], error: null });
        if (table === 'slot_catalog_items') return builder({ data: [{ id: 'item-1' }], error: null });
        return builder({
          data: { reference: '50402', manufacturer: 'Avant Slot', model_name: 'Porsche 911' },
          error: null,
        });
      }),
    });
    const body = await getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' });
    expect(body.item).toEqual({
      reference: '50402',
      manufacturer: 'Avant Slot',
      model_name: 'Porsche 911',
    });
    expect(body.item.id).toBeUndefined();
  });

  test('el comodín no se convierte en una búsqueda', async () => {
    const items = builder({ data: [], error: null });
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => (table === 'slot_catalog_brands'
        ? builder({ data: [{ id: 'brand-1' }], error: null })
        : items)),
    });
    await expect(getCatalogItem(USER, { reference: '10%', manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(items.eq).toHaveBeenCalledWith('reference', '10%');
    expect(items.ilike).not.toHaveBeenCalled();
  });

  test('la ficha de catálogo admite 10 consultas por minuto', async () => {
    getServiceClient.mockReturnValue({
      from: jest.fn(() => builder({ data: [], error: null })),
    });
    for (let i = 0; i < 10; i += 1) {
      await expect(getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' }))
        .rejects.toMatchObject({ statusCode: 404 });
    }
    await expect(getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 429 });
  });

  test('guarda la consulta y respeta el cupo ya registrado', async () => {
    const inserts = [];
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table !== 'mcp_catalog_lookups') return builder({ data: [], error: null });
        const result = { data: null, error: null, count: 100 };
        const b = {
          select: jest.fn(() => b),
          eq: jest.fn(() => b),
          in: jest.fn(() => b),
          gte: jest.fn(() => b),
          insert: jest.fn((row) => {
            inserts.push(row);
            return b;
          }),
          then(onFulfilled, onRejected) {
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };
        return b;
      }),
    });
    await expect(getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' }, { clientId: 'mcp_abc' }))
      .rejects.toMatchObject({ statusCode: 429, message: 'Demasiadas consultas al catálogo. Máximo 100 al día.' });
    expect(inserts).toEqual([
      expect.objectContaining({
        user_id: USER,
        client_id: 'mcp_abc',
        reference: '50402',
        manufacturer: 'Avant Slot',
        outcome: 'daily_limited',
      }),
    ]);
  });

  test('una ficha no encontrada queda registrada', async () => {
    const inserts = [];
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table !== 'mcp_catalog_lookups') return builder({ data: [], error: null });
        const b = builder({ data: null, error: null });
        b.insert = jest.fn((row) => {
          inserts.push(row);
          return b;
        });
        return b;
      }),
    });
    await expect(getCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(inserts).toEqual([
      expect.objectContaining({ outcome: 'not_found', reference: '50402', manufacturer: 'Avant Slot' }),
    ]);
  });
});
