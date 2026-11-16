'use strict';

jest.mock('../../lib/supabaseClients', () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(() => ({ from: jest.fn() })),
  getServiceOrAnonClient: jest.fn(),
  createUserScopedClient: jest.fn(),
  createServerClient: jest.fn(),
}));

const { getServiceClient } = require('../../lib/supabaseClients');
const { resetCatalogLookupLimit } = require('../../lib/mcpReadTools');
const {
  garageSummary,
  bestLaps,
  getCircuit,
  listMaintenance,
  listInventory,
  getCatalogOffers,
} = require('../../lib/mcpInsightTools');

const USER = 'user-a';
const OTHER = 'user-b';
const CIRCUIT_ID = '11111111-1111-4111-8111-111111111111';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';

function builder(result) {
  const b = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    ilike: jest.fn(() => b),
    in: jest.fn(() => b),
    neq: jest.fn(() => b),
    not: jest.fn(() => b),
    is: jest.fn(() => b),
    or: jest.fn(() => b),
    gt: jest.fn(() => b),
    gte: jest.fn(() => b),
    lte: jest.fn(() => b),
    order: jest.fn(() => b),
    limit: jest.fn(() => b),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return b;
}

describe('mcpInsightTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCatalogLookupLimit();
  });

  test('garage_summary ignora user_id y agrega el garaje del token', async () => {
    const vehicles = builder({
      data: [
        { id: '1', manufacturer: 'Scalextric', type: 'GT', price: 10, catalog_item_id: null, modified: true, digital: false },
        { id: '2', manufacturer: 'Scalextric', type: 'GT', price: 5.5, catalog_item_id: 'c', modified: false, digital: true },
      ],
      error: null,
    });
    getServiceClient.mockReturnValue({ from: jest.fn(() => vehicles) });
    const body = await garageSummary(USER, { user_id: OTHER });
    expect(vehicles.eq).toHaveBeenCalledWith('user_id', USER);
    expect(vehicles.eq).not.toHaveBeenCalledWith('user_id', OTHER);
    expect(body).toMatchObject({
      total: 2,
      modified: 1,
      digital: 1,
      purchase_total: 15.5,
      unlinked_catalog: 1,
      truncated: false,
      by_manufacturer: [{ name: 'Scalextric', count: 2 }],
      by_type: [{ name: 'GT', count: 2 }],
    });
  });

  test('best_laps agrupa por coche, circuito y carril y corta a 25', async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({
      best_lap_time: index + 1,
      timing_date: '2026-01-01',
      circuit: 'Casa',
      circuit_id: CIRCUIT_ID,
      lane: '1',
      vehicle_id: `v${index}`,
      vehicles: { id: `v${index}`, model: `M${index}`, manufacturer: 'Scalextric' },
    }));
    rows.push({ ...rows[0], best_lap_time: 50 });
    const timings = builder({ data: rows, error: null });
    getServiceClient.mockReturnValue({ from: jest.fn(() => timings) });
    const body = await bestLaps(USER, { user_id: OTHER });
    expect(timings.eq).toHaveBeenCalledWith('vehicles.user_id', USER);
    expect(timings.eq).not.toHaveBeenCalledWith('user_id', OTHER);
    expect(body.laps).toHaveLength(25);
    expect(body.laps[0].best_lap_time).toBe(1);
    expect(body.laps.some((lap) => lap.best_lap_time === 26 || lap.best_lap_time === 50)).toBe(false);
  });

  test('get_circuit no devuelve un circuito de otra cuenta', async () => {
    const circuits = builder({ data: null, error: null });
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table !== 'circuits') throw new Error(`consulta inesperada: ${table}`);
        return circuits;
      }),
    });
    await expect(getCircuit(USER, { id: CIRCUIT_ID, user_id: OTHER }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Circuito no encontrado' });
    expect(circuits.eq).toHaveBeenCalledWith('user_id', USER);
  });

  test('list_maintenance no devuelve revisiones de un coche ajeno', async () => {
    const vehicles = builder({ data: null, error: null });
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table !== 'vehicles') throw new Error(`consulta inesperada: ${table}`);
        return vehicles;
      }),
    });
    await expect(listMaintenance(USER, { vehicle_id: VEHICLE_ID, user_id: OTHER }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Vehículo no encontrado' });
    expect(vehicles.eq).toHaveBeenCalledWith('user_id', USER);
  });

  test('list_inventory filtra por el usuario del token', async () => {
    const items = builder({
      data: [{ id: 'i1', name: 'Motor', reference: 'M1', category: 'motor', quantity: 2, min_stock: 1, unit: 'uds' }],
      error: null,
    });
    getServiceClient.mockReturnValue({ from: jest.fn(() => items) });
    const body = await listInventory(USER, { user_id: OTHER, category: 'motor' });
    expect(items.eq).toHaveBeenCalledWith('user_id', USER);
    expect(items.eq).not.toHaveBeenCalledWith('user_id', OTHER);
    expect(body.items).toHaveLength(1);
  });

  test('get_catalog_offers comparte el cupo diario del catálogo', async () => {
    const inserts = [];
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table !== 'mcp_catalog_lookups') return builder({ data: [], error: null });
        const result = { data: null, error: null, count: 100 };
        const lookups = {
          select: jest.fn(() => lookups),
          eq: jest.fn(() => lookups),
          in: jest.fn(() => lookups),
          gte: jest.fn(() => lookups),
          insert: jest.fn((row) => {
            inserts.push(row);
            return lookups;
          }),
          then(onFulfilled, onRejected) {
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };
        return lookups;
      }),
    });
    await expect(getCatalogOffers(USER, { reference: '50402', manufacturer: 'Avant Slot' }, { clientId: 'mcp_abc' }))
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
});
