const { summarizeCatalogItemIdRaw, logVehicleSaveError } = require('../../lib/logVehicleSaveError');
const { getServiceClient } = require('../../lib/supabaseClients');

jest.mock('../../lib/supabaseClients', () => ({
  getServiceClient: jest.fn(),
}));

const ITEM_ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';

describe('logVehicleSaveError', () => {
  beforeEach(() => {
    getServiceClient.mockReset();
  });

  test('summarizeCatalogItemIdRaw no vuelca el body: array duplicado queda en un resumen corto', () => {
    expect(summarizeCatalogItemIdRaw([ITEM_ID, ITEM_ID])).toBe(`array:2:${ITEM_ID},${ITEM_ID}`);
    expect(summarizeCatalogItemIdRaw(ITEM_ID)).toBe(ITEM_ID);
    expect(summarizeCatalogItemIdRaw(null)).toBeNull();
  });

  test('inserta en vehicle_save_errors con service role y recorta el mensaje', async () => {
    const inserts = [];
    getServiceClient.mockReturnValue({
      from: jest.fn((table) => {
        expect(table).toBe('vehicle_save_errors');
        return {
          insert: jest.fn((row) => {
            inserts.push(row);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    });

    await logVehicleSaveError({
      userId: 'user-1',
      route: 'POST /api/vehicles',
      status: 400,
      errorMessage: 'catalog_item_id no existe en el catálogo',
      catalogItemIdRaw: [ITEM_ID, ITEM_ID],
      source: 'suggest',
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({
      user_id: 'user-1',
      route: 'POST /api/vehicles',
      status: 400,
      error_message: 'catalog_item_id no existe en el catálogo',
      catalog_item_id_raw: `array:2:${ITEM_ID},${ITEM_ID}`,
      source: 'suggest',
    });
  });

  test('si el insert falla, no lanza', async () => {
    getServiceClient.mockReturnValue({
      from: () => ({
        insert: () => Promise.resolve({ error: { message: 'rls' } }),
      }),
    });
    await expect(
      logVehicleSaveError({ route: 'POST /api/vehicles', status: 500, errorMessage: 'boom' }),
    ).resolves.toBeUndefined();
  });

  test('no escribe en 2xx', async () => {
    const from = jest.fn();
    getServiceClient.mockReturnValue({ from });
    await logVehicleSaveError({ route: 'POST /api/vehicles', status: 201, errorMessage: 'no' });
    expect(from).not.toHaveBeenCalled();
  });
});
