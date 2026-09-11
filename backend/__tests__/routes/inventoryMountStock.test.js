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
const { createUserScopedClient } = require('../../lib/supabaseClients');
const { createMemorySupabase } = require('../helpers/memorySupabase');
const { buildPartIdentity } = require('../../lib/partsRegistry');

const USER = 'test-user-id';

function baseTables(extraItems = []) {
  const ident = buildPartIdentity({
    category: 'pinion',
    name: 'Pinon 9',
    manufacturer: 'Slot',
    teeth: 9,
  });
  return {
    vehicles: [
      {
        id: 'veh-1',
        user_id: USER,
        model: 'GT',
        manufacturer: 'Slot',
        price: 100,
      },
    ],
    technical_specs: [
      { id: 'spec-mod', vehicle_id: 'veh-1', is_modification: true },
      { id: 'spec-tech', vehicle_id: 'veh-1', is_modification: false },
    ],
    parts: [
      {
        id: 'part-1',
        user_id: USER,
        identity_key: ident.identityKey,
        ...ident.fields,
      },
    ],
    inventory_items: extraItems,
    components: [],
    component_modification_history: [],
  };
}

function line(id, quantity, createdAt) {
  return {
    id,
    user_id: USER,
    part_id: 'part-1',
    name: 'Pinon 9',
    category: 'pinion',
    manufacturer: 'Slot',
    teeth: 9,
    quantity,
    purchase_price: 2,
    created_at: createdAt,
    vehicle_id: null,
  };
}

function wireDb(db) {
  mockSupabase.from.mockImplementation((table) => db.from(table));
}

describe('POST /api/inventory/:id/mount stock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER } },
      error: null,
    });
  });

  test('montaje como modificación descuenta stock y usa JWT user-scoped', async () => {
    const db = createMemorySupabase(
      baseTables([line('inv-1', 5, '2026-01-01T00:00:00.000Z')]),
    );
    wireDb(db);

    const response = await request(app)
      .post('/api/inventory/inv-1/mount')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicle_id: 'veh-1',
        is_modification: true,
        mount_qty: 2,
        manufacturer: 'Slot',
        teeth: 9,
      });

    expect(response.status).toBe(201);
    expect(createUserScopedClient).toHaveBeenCalledWith('Bearer test-token');
    expect(response.body.component.tech_spec_id).toBe('spec-mod');
    expect(response.body.component.mounted_qty).toBe(2);
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-1').quantity).toBe(3);
    expect(db.snapshot('components')).toHaveLength(1);
  });

  test('montaje en ficha técnica (is_modification false) también descuenta', async () => {
    const db = createMemorySupabase(
      baseTables([line('inv-1', 4, '2026-01-01T00:00:00.000Z')]),
    );
    wireDb(db);

    const response = await request(app)
      .post('/api/inventory/inv-1/mount')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicle_id: 'veh-1',
        is_modification: false,
        mount_qty: 1,
        manufacturer: 'Slot',
        teeth: 9,
      });

    expect(response.status).toBe(201);
    expect(response.body.component.tech_spec_id).toBe('spec-tech');
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-1').quantity).toBe(3);
    expect(db.snapshot('components')).toHaveLength(1);
  });

  test('FIFO a través de 2 líneas al montar', async () => {
    const db = createMemorySupabase(
      baseTables([
        line('inv-a', 2, '2026-01-01T00:00:00.000Z'),
        line('inv-b', 3, '2026-01-02T00:00:00.000Z'),
      ]),
    );
    wireDb(db);

    const response = await request(app)
      .post('/api/inventory/inv-b/mount')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicle_id: 'veh-1',
        is_modification: true,
        mount_qty: 4,
        manufacturer: 'Slot',
        teeth: 9,
      });

    expect(response.status).toBe(201);
    expect(response.body.component.source_inventory_item_id).toBe('inv-a');
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-a').quantity).toBe(0);
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-b').quantity).toBe(1);
  });

  test('stock insuficiente no inserta componente', async () => {
    const db = createMemorySupabase(
      baseTables([line('inv-1', 1, '2026-01-01T00:00:00.000Z')]),
    );
    wireDb(db);

    const response = await request(app)
      .post('/api/inventory/inv-1/mount')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicle_id: 'veh-1',
        is_modification: false,
        mount_qty: 5,
        manufacturer: 'Slot',
        teeth: 9,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect(response.body.error).toMatch(/Stock insuficiente/);
    expect(db.snapshot('components')).toHaveLength(0);
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-1').quantity).toBe(1);
  });
});
