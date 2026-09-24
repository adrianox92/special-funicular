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

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');
const { createMemorySupabase } = require('../helpers/memorySupabase');
const { buildPartIdentity } = require('../../lib/partsRegistry');

const USER = 'test-user-id';

function identForPinon() {
  return buildPartIdentity({
    category: 'pinion',
    name: 'Pinon 9',
    manufacturer: 'Slot',
    teeth: 9,
  });
}

function seedDb({ items, component }) {
  const ident = identForPinon();
  return createMemorySupabase({
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
    inventory_items: items,
    components: component ? [component] : [],
    component_modification_history: [],
  });
}

function invLine(id, quantity, createdAt) {
  return {
    id,
    user_id: USER,
    part_id: 'part-1',
    name: 'Pinon 9',
    category: 'pinion',
    manufacturer: 'Slot',
    teeth: 9,
    quantity,
    created_at: createdAt,
    updated_at: createdAt,
    notes: null,
  };
}

describe('technical-specs stock consume/return', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER } },
      error: null,
    });
  });

  test('POST con deduct_from_inventory y stock insuficiente no inserta', async () => {
    const db = seedDb({
      items: [invLine('inv-1', 1, '2026-01-01T00:00:00.000Z')],
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        deduct_from_inventory: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 4,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect(response.body).not.toHaveProperty('inventory_deduct_warnings');
    expect(db.snapshot('components')).toHaveLength(0);
    expect(db.snapshot('inventory_items')[0].quantity).toBe(1);
  });

  test('POST de modificación sin línea de inventario crea la pieza a stock 0 y guarda', async () => {
    const db = seedDb({ items: [] });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        deduct_from_inventory: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            price: 3.5,
            mounted_qty: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.inventory_created_at_zero).toBe(true);
    expect(response.body.inventory_notice).toMatch(/stock 0/);
    expect(response.body.inventory_notice).toMatch(/Inventario/);
    expect(response.body).not.toHaveProperty('code');
    expect(db.snapshot('components')).toHaveLength(1);
    const lines = db.snapshot('inventory_items');
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(0);
    expect(lines[0].part_id).toBe('part-1');
    expect(lines[0].name).toBe('Pinon 9');
    expect(Number(lines[0].purchase_price)).toBe(3.5);
    expect(db.snapshot('components')[0].source_inventory_item_id).toBe(lines[0].id);
  });

  test('POST de modificación crea pieza y stock 0 aunque la referencia no exista en parts', async () => {
    const db = createMemorySupabase({
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
      parts: [],
      inventory_items: [],
      components: [],
      component_modification_history: [],
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        deduct_from_inventory: true,
        components: [
          {
            component_type: 'motor',
            element: 'Motor nuevo',
            manufacturer: 'Scaleauto',
            sku: 'SC-001',
            rpm: 20000,
            mounted_qty: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.inventory_created_at_zero).toBe(true);
    expect(db.snapshot('parts')).toHaveLength(1);
    expect(db.snapshot('parts')[0].reference).toBe('SC-001');
    const lines = db.snapshot('inventory_items');
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(0);
    expect(lines[0].reference).toBe('SC-001');
    expect(lines[0].part_id).toBe(db.snapshot('parts')[0].id);
    expect(db.snapshot('components')).toHaveLength(1);
  });

  test('POST de modificación con la pieza ya en inventario y stock 0 sigue bloqueando', async () => {
    const db = seedDb({
      items: [invLine('inv-1', 0, '2026-01-01T00:00:00.000Z')],
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        deduct_from_inventory: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect(response.body.error).toMatch(/Stock insuficiente \(disponible: 0, necesario: 1\)/);
    expect(db.snapshot('components')).toHaveLength(0);
    expect(db.snapshot('inventory_items')).toHaveLength(1);
    expect(db.snapshot('inventory_items')[0].quantity).toBe(0);
  });

  test('POST de pieza de serie sin inventario y con descuento no crea stock 0', async () => {
    const db = seedDb({ items: [] });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: false,
        deduct_from_inventory: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect(db.snapshot('components')).toHaveLength(0);
    expect(db.snapshot('inventory_items')).toHaveLength(0);
  });

  test('POST de pieza de serie sin deduct_from_inventory no toca el stock', async () => {
    const db = seedDb({
      items: [invLine('inv-1', 5, '2026-01-01T00:00:00.000Z')],
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .post('/api/vehicles/veh-1/technical-specs')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: false,
        deduct_from_inventory: false,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(db.snapshot('components')).toHaveLength(1);
    expect(db.snapshot('inventory_items')[0].quantity).toBe(5);
  });

  test('PUT aumenta mounted_qty con línea origen agotada usando FIFO', async () => {
    const db = seedDb({
      items: [
        invLine('inv-a', 0, '2026-01-01T00:00:00.000Z'),
        invLine('inv-b', 3, '2026-01-02T00:00:00.000Z'),
      ],
      component: {
        id: 'comp-1',
        tech_spec_id: 'spec-mod',
        component_type: 'pinion',
        element: 'Pinon 9',
        manufacturer: 'Slot',
        teeth: 9,
        mounted_qty: 2,
        source_inventory_item_id: 'inv-a',
        part_id: 'part-1',
        price: 2,
        sku: null,
        url: null,
        material: null,
        size: null,
        color: null,
        rpm: null,
        gaus: null,
        description: null,
      },
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .put('/api/vehicles/veh-1/technical-specs/spec-mod/components/comp-1')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 3,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.inventory_deducted_qty).toBe(1);
    expect(db.snapshot('components')[0].mounted_qty).toBe(3);
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-a').quantity).toBe(0);
    expect(db.snapshot('inventory_items').find((i) => i.id === 'inv-b').quantity).toBe(2);
  });

  test('PUT con origen agotado y sin más stock no sube la cantidad', async () => {
    const db = seedDb({
      items: [invLine('inv-a', 0, '2026-01-01T00:00:00.000Z')],
      component: {
        id: 'comp-1',
        tech_spec_id: 'spec-mod',
        component_type: 'pinion',
        element: 'Pinon 9',
        manufacturer: 'Slot',
        teeth: 9,
        mounted_qty: 2,
        source_inventory_item_id: 'inv-a',
        part_id: 'part-1',
        price: 2,
        sku: null,
        url: null,
        material: null,
        size: null,
        color: null,
        rpm: null,
        gaus: null,
        description: null,
      },
    });
    mockSupabase.from.mockImplementation((table) => db.from(table));

    const response = await request(app)
      .put('/api/vehicles/veh-1/technical-specs/spec-mod/components/comp-1')
      .set('Authorization', 'Bearer test-token')
      .send({
        is_modification: true,
        components: [
          {
            component_type: 'pinion',
            element: 'Pinon 9',
            manufacturer: 'Slot',
            teeth: 9,
            mounted_qty: 3,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect(db.snapshot('components')[0].mounted_qty).toBe(2);
  });

  test('las rutas de specs no devuelven warnings silenciosos ni omiten descuento por is_modification', () => {
    const vehicles = fs.readFileSync(path.join(__dirname, '../../routes/vehicles.js'), 'utf8');
    const inventory = fs.readFileSync(path.join(__dirname, '../../routes/inventory.js'), 'utf8');
    expect(vehicles).not.toMatch(/inventory_deduct_warnings/);
    expect(vehicles).toMatch(/consumeInventoryStock\(req\.supabase/);
    expect(inventory).toMatch(/consumeInventoryStock\(req\.supabase/);
    expect(inventory).not.toMatch(/shouldDeduct/);
    expect(vehicles).toMatch(/createUserScopedClient/);
  });
});
