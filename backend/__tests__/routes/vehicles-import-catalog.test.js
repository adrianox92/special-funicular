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

const USER_ID = 'test-user-id';
const AUTH = { Authorization: 'Bearer test-token' };
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';
const CATALOG_IMAGE = 'https://cdn.example/catalog/c1234.webp';
const OWN_IMAGE = 'https://cdn.example/vehicles/v1/front.webp';

const CSV = 'modelo,fabricante,referencia\nPorsche 911,Scalextric,C1234\n';
const MAPPING = JSON.stringify({
  model: 'modelo',
  manufacturer: 'fabricante',
  reference: 'referencia',
});

function chain(result) {
  const builder = {
    inserts: [],
    updates: [],
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    or: jest.fn(() => builder),
    insert: jest.fn((payload) => {
      builder.inserts.push(payload);
      return builder;
    }),
    update: jest.fn((payload) => {
      builder.updates.push(payload);
      return builder;
    }),
    maybeSingle: jest.fn(async () => result),
    single: jest.fn(async () => result),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function scriptFrom(steps) {
  const queue = [...steps];
  const builders = [];
  mockSupabase.from.mockImplementation((table) => {
    const step = queue.shift();
    if (!step) throw new Error(`from(${table}) inesperado`);
    if (step.table !== table) {
      throw new Error(`esperado from(${step.table}), llegó from(${table})`);
    }
    const builder = chain(step.result);
    builders.push(builder);
    return builder;
  });
  return builders;
}

function importCsv(duplicateMode) {
  return request(app)
    .post('/api/vehicles/import')
    .set(AUTH)
    .attach('file', Buffer.from(CSV), { filename: 'coches.csv', contentType: 'text/csv' })
    .field('mapping', MAPPING)
    .field('duplicateMode', duplicateMode);
}

describe('importación y foto de catálogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    mockSupabase.storage.from.mockReset();
  });

  test('alta con coincidencia exacta guarda catalog_item_id y no copia la foto', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: ITEM_ID, error: null });
    const builders = scriptFrom([
      { table: 'vehicles', result: { data: [], error: null } },
      { table: 'slot_catalog_items_with_ratings', result: { data: { id: ITEM_ID, image_url: CATALOG_IMAGE }, error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID }, error: null } },
    ]);

    const response = await importCsv('skip');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      inserted: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
      catalogLinked: 1,
    }));
    expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_slot_catalog_item_by_brand_and_reference', {
      p_brand_name: 'Scalextric',
      p_user_reference: 'C1234',
    });
    expect(builders[2].inserts[0][0].catalog_item_id).toBe(ITEM_ID);
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  test('alta sin coincidencia inserta catalog_item_id nulo', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const builders = scriptFrom([
      { table: 'vehicles', result: { data: [], error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID }, error: null } },
    ]);

    const response = await importCsv('import');

    expect(response.status).toBe(200);
    expect(response.body.inserted).toBe(1);
    expect(response.body.catalogLinked).toBe(0);
    expect(builders[1].inserts[0][0].catalog_item_id).toBeNull();
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  test('duplicado en update guarda la ficha cuando hay coincidencia', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: ITEM_ID, error: null });
    const builders = scriptFrom([
      { table: 'vehicles', result: { data: [{ id: VEHICLE_ID }], error: null } },
      { table: 'slot_catalog_items_with_ratings', result: { data: { id: ITEM_ID }, error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID, catalog_item_id: null }, error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID }, error: null } },
    ]);

    const response = await importCsv('update');

    expect(response.status).toBe(200);
    expect(response.body.updated).toBe(1);
    expect(response.body.catalogLinked).toBe(1);
    expect(builders[3].updates[0].catalog_item_id).toBe(ITEM_ID);
  });

  test('duplicado en update no borra catalog_item_id si no hay coincidencia', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const builders = scriptFrom([
      { table: 'vehicles', result: { data: [{ id: VEHICLE_ID }], error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID, catalog_item_id: ITEM_ID }, error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID }, error: null } },
    ]);

    const response = await importCsv('update');

    expect(response.status).toBe(200);
    expect(response.body.updated).toBe(1);
    expect(response.body.catalogLinked).toBe(0);
    expect(builders[2].updates[0]).not.toHaveProperty('catalog_item_id');
  });

  test('duplicado en skip no resuelve el catálogo', async () => {
    const builders = scriptFrom([
      { table: 'vehicles', result: { data: [{ id: VEHICLE_ID }], error: null } },
    ]);

    const response = await importCsv('skip');

    expect(response.status).toBe(200);
    expect(response.body.skipped).toBe(1);
    expect(response.body.catalogLinked).toBe(0);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(builders[0].updates).toEqual([]);
    expect(builders[0].inserts).toEqual([]);
  });

  test('el alta manual no sube una copia de la foto del catálogo', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: ITEM_ID, error: null });
    const builders = scriptFrom([
      { table: 'slot_catalog_items_with_ratings', result: { data: { id: ITEM_ID, image_url: CATALOG_IMAGE }, error: null } },
      { table: 'vehicles', result: { data: { id: VEHICLE_ID }, error: null } },
    ]);

    const response = await request(app)
      .post('/api/vehicles')
      .set(AUTH)
      .field('model', 'Porsche 911')
      .field('manufacturer', 'Scalextric')
      .field('reference', 'C1234');

    expect(response.status).toBe(201);
    expect(builders[1].inserts[0][0].catalog_item_id).toBe(ITEM_ID);
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });
});

describe('GET /api/vehicles imagen de catálogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  function mockList({ vehicle, images, catalogRows }) {
    const tables = [];
    let vehicleCalls = 0;
    mockSupabase.from.mockImplementation((table) => {
      tables.push(table);
      if (table === 'vehicles') {
        vehicleCalls += 1;
        if (vehicleCalls === 1) return chain({ data: null, count: 1, error: null });
        return chain({ data: [vehicle], error: null });
      }
      if (table === 'vehicle_images') return chain({ data: images, error: null });
      if (table === 'slot_catalog_items') return chain({ data: catalogRows, error: null });
      throw new Error(`tabla inesperada ${table}`);
    });
    return tables;
  }

  test('usa la URL del catálogo si el vehículo no tiene foto propia', async () => {
    const tables = mockList({
      vehicle: { id: 'v1', catalog_item_id: ITEM_ID, model: 'Porsche 911' },
      images: [],
      catalogRows: [{ id: ITEM_ID, image_url: CATALOG_IMAGE }],
    });

    const response = await request(app).get('/api/vehicles?page=1&limit=25').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.vehicles[0].image).toBe(CATALOG_IMAGE);
    expect(tables).toContain('slot_catalog_items');
  });

  test('la foto propia gana a la del catálogo', async () => {
    mockList({
      vehicle: { id: 'v1', catalog_item_id: ITEM_ID, model: 'Porsche 911' },
      images: [{ vehicle_id: 'v1', image_url: OWN_IMAGE, view_type: 'front' }],
      catalogRows: [{ id: ITEM_ID, image_url: CATALOG_IMAGE }],
    });

    const response = await request(app).get('/api/vehicles?page=1&limit=25').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.vehicles[0].image).toBe(OWN_IMAGE);
  });
});
