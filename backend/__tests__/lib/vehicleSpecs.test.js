const fs = require('fs');
const path = require('path');
const { updateVehicleTotalPrice, getOrCreateBaseSpecs } = require('../../lib/vehicleSpecs');

function createQueryBuilder(resolveValue = { data: null, error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('vehicleSpecs client injection', () => {
  test('el módulo no usa getAnonClient (RLS exige JWT de usuario)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../lib/vehicleSpecs.js'), 'utf8');
    expect(src).not.toMatch(/getAnonClient/);
    expect(src).not.toMatch(/supabaseClients/);
  });

  test('los callers pasan req.supabase y no el id suelto', () => {
    const vehicles = fs.readFileSync(path.join(__dirname, '../../routes/vehicles.js'), 'utf8');
    const inventory = fs.readFileSync(path.join(__dirname, '../../routes/inventory.js'), 'utf8');
    expect(vehicles).toMatch(/getOrCreateBaseSpecs\(req\.supabase,/);
    expect(vehicles).toMatch(/updateVehicleTotalPrice\(req\.supabase,/);
    expect(vehicles).not.toMatch(/getOrCreateBaseSpecs\(id\)/);
    expect(vehicles).not.toMatch(/updateVehicleTotalPrice\(id\)/);
    expect(inventory).toMatch(/getOrCreateBaseSpecs\(req\.supabase,/);
    expect(inventory).toMatch(/updateVehicleTotalPrice\(req\.supabase,/);
    expect(inventory).not.toMatch(/getOrCreateBaseSpecs\(vehicleId\)/);
    expect(inventory).not.toMatch(/updateVehicleTotalPrice\(vehicleId\)/);
  });

  test('updateVehicleTotalPrice lee y actualiza con el cliente inyectado', async () => {
    const vehicleSelect = createQueryBuilder({ data: { price: 100 }, error: null });
    const specsSelect = createQueryBuilder({ data: [{ id: 'spec-mod' }], error: null });
    const compsSelect = createQueryBuilder({
      data: [{ price: 10, mounted_qty: 2 }],
      error: null,
    });
    const vehicleUpdate = createQueryBuilder({ data: null, error: null });

    let vehiclesFromCalls = 0;
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'vehicles') {
          vehiclesFromCalls += 1;
          return vehiclesFromCalls === 1 ? vehicleSelect : vehicleUpdate;
        }
        if (table === 'technical_specs') return specsSelect;
        if (table === 'components') return compsSelect;
        throw new Error(`tabla inesperada: ${table}`);
      }),
    };

    await updateVehicleTotalPrice(supabase, 'veh-1');

    expect(supabase.from).toHaveBeenCalledWith('vehicles');
    expect(supabase.from).toHaveBeenCalledWith('technical_specs');
    expect(supabase.from).toHaveBeenCalledWith('components');
    expect(vehicleSelect.select).toHaveBeenCalledWith('price');
    expect(vehicleSelect.eq).toHaveBeenCalledWith('id', 'veh-1');
    expect(vehicleUpdate.update).toHaveBeenCalledWith({
      total_price: 120,
      modified: true,
    });
    expect(vehicleUpdate.eq).toHaveBeenCalledWith('id', 'veh-1');
  });

  test('updateVehicleTotalPrice marca modified=false si no hay componentes de modificación', async () => {
    const vehicleSelect = createQueryBuilder({ data: { price: 50 }, error: null });
    const specsSelect = createQueryBuilder({ data: [], error: null });
    const vehicleUpdate = createQueryBuilder({ data: null, error: null });

    let vehiclesFromCalls = 0;
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'vehicles') {
          vehiclesFromCalls += 1;
          return vehiclesFromCalls === 1 ? vehicleSelect : vehicleUpdate;
        }
        if (table === 'technical_specs') return specsSelect;
        throw new Error(`tabla inesperada: ${table}`);
      }),
    };

    await updateVehicleTotalPrice(supabase, 'veh-2');

    expect(vehicleUpdate.update).toHaveBeenCalledWith({
      total_price: 50,
      modified: false,
    });
  });

  test('getOrCreateBaseSpecs usa el cliente inyectado y no crea filas si ya existen', async () => {
    const existing = [
      { id: 'mod-1', is_modification: true },
      { id: 'tech-1', is_modification: false },
    ];
    const specsSelect = createQueryBuilder({ data: existing, error: null });
    const supabase = {
      from: jest.fn((table) => {
        expect(table).toBe('technical_specs');
        return specsSelect;
      }),
    };

    const specs = await getOrCreateBaseSpecs(supabase, 'veh-3');

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(specsSelect.eq).toHaveBeenCalledWith('vehicle_id', 'veh-3');
    expect(specs.modification.id).toBe('mod-1');
    expect(specs.technical.id).toBe('tech-1');
  });

  test('getOrCreateBaseSpecs inserta specs faltantes con el cliente inyectado', async () => {
    const specsSelect = createQueryBuilder({ data: [], error: null });
    const insertMod = createQueryBuilder({
      data: { id: 'new-mod', is_modification: true },
      error: null,
    });
    const insertTech = createQueryBuilder({
      data: { id: 'new-tech', is_modification: false },
      error: null,
    });

    let fromCalls = 0;
    const supabase = {
      from: jest.fn((table) => {
        expect(table).toBe('technical_specs');
        fromCalls += 1;
        if (fromCalls === 1) return specsSelect;
        if (fromCalls === 2) return insertMod;
        return insertTech;
      }),
    };

    const specs = await getOrCreateBaseSpecs(supabase, 'veh-4');

    expect(insertMod.insert).toHaveBeenCalledWith([
      expect.objectContaining({ vehicle_id: 'veh-4', is_modification: true }),
    ]);
    expect(insertTech.insert).toHaveBeenCalledWith([
      expect.objectContaining({ vehicle_id: 'veh-4', is_modification: false }),
    ]);
    expect(specs.modification.id).toBe('new-mod');
    expect(specs.technical.id).toBe('new-tech');
  });
});
