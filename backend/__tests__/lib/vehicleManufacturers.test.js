const {
  fetchDistinctVehicleManufacturers,
  VEHICLE_MANUFACTURER_PAGE_SIZE,
} = require('../../lib/vehicleManufacturers');

function createBuilder(pages) {
  let call = 0;
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    then(onFulfilled, onRejected) {
      const data = pages[call] ?? [];
      call += 1;
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };
  return { builder, getCallCount: () => call };
}

describe('fetchDistinctVehicleManufacturers', () => {
  test('recorta, ignora vacíos y ordena sin distinguir mayúsculas', async () => {
    const { builder } = createBuilder([
      [
        { id: '1', manufacturer: ' Scalextric ' },
        { id: '2', manufacturer: '' },
        { id: '3', manufacturer: null },
        { id: '4', manufacturer: 'Ninco' },
        { id: '5', manufacturer: 'Scalextric' },
      ],
    ]);
    const supabase = { from: jest.fn(() => builder) };

    const names = await fetchDistinctVehicleManufacturers(supabase, 'user-1');

    expect(supabase.from).toHaveBeenCalledWith('vehicles');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(builder.range).toHaveBeenCalledWith(0, VEHICLE_MANUFACTURER_PAGE_SIZE - 1);
    expect(names).toEqual(['Ninco', 'Scalextric']);
  });

  test('pagina más allá del límite PostgREST de 1000 filas (marcas solo en página 2)', async () => {
    const page1 = Array.from({ length: VEHICLE_MANUFACTURER_PAGE_SIZE }, (_, i) => ({
      id: `a-${i}`,
      manufacturer: 'Ninco',
    }));
    const page2 = [{ id: 'b-1', manufacturer: 'Slot.it' }];
    const { builder, getCallCount } = createBuilder([page1, page2]);
    const supabase = { from: jest.fn(() => builder) };

    const names = await fetchDistinctVehicleManufacturers(supabase, 'user-1');

    expect(getCallCount()).toBe(2);
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(names).toEqual(['Ninco', 'Slot.it']);
  });
});
