'use strict';

jest.mock('../../lib/supabaseClients', () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(() => ({ from: jest.fn() })),
  getServiceOrAnonClient: jest.fn(),
  createUserScopedClient: jest.fn(),
  createServerClient: jest.fn(),
}));

const { getServiceClient } = require('../../lib/supabaseClients');
const { listIncompleteCatalogItems, updateCatalogItem } = require('../../lib/mcpAdminCatalog');
const { listCapabilities } = require('../../lib/mcpInsightTools');

const USER = 'user-a';
const ADMIN_EMAIL = 'admin@slot.test';

function builder(result) {
  const b = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    ilike: jest.fn(() => b),
    or: jest.fn(() => b),
    order: jest.fn(() => b),
    range: jest.fn(() => b),
    limit: jest.fn(() => b),
    update: jest.fn(() => b),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return b;
}

function client({ email, from }) {
  return {
    from,
    auth: email
      ? { admin: { getUserById: jest.fn(async () => ({ data: { user: { email } }, error: null })) } }
      : undefined,
  };
}

describe('mcpAdminCatalog', () => {
  const previousAdmins = process.env.LICENSE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ADMIN_EMAILS = ADMIN_EMAIL;
  });

  afterAll(() => {
    if (previousAdmins == null) delete process.env.LICENSE_ADMIN_EMAILS;
    else process.env.LICENSE_ADMIN_EMAILS = previousAdmins;
  });

  test('sin email de admin responde 403 y no consulta el catálogo', async () => {
    const from = jest.fn();
    getServiceClient.mockReturnValue(client({ from }));
    await expect(listIncompleteCatalogItems(USER, { manufacturer: 'Avant Slot' }))
      .rejects.toMatchObject({ statusCode: 403, message: 'Solo administradores' });
    await expect(updateCatalogItem(USER, { reference: '50402', manufacturer: 'Avant Slot', model_name: 'Porsche' }))
      .rejects.toMatchObject({ statusCode: 403, message: 'Solo administradores' });
    expect(from).not.toHaveBeenCalled();
  });

  test('el listado filtra por marca y por el campo que falta', async () => {
    const brands = builder({ data: [{ id: 'brand-1' }], error: null });
    const items = builder({
      data: [{
        reference: '50402',
        manufacturer: 'Avant Slot',
        model_name: 'Porsche',
        vehicle_type: null,
        traction: '4x4',
        motor_position: 'inline',
        commercial_release_year: 2020,
        dorsal: '1',
        image_url: 'https://img.example/50402.jpg',
      }],
      error: null,
      count: 1,
    });
    getServiceClient.mockReturnValue(client({
      email: ADMIN_EMAIL,
      from: jest.fn((table) => (table === 'slot_catalog_brands' ? brands : items)),
    }));
    const body = await listIncompleteCatalogItems(USER, {
      manufacturer: 'Avant Slot',
      missing: 'vehicle_type',
      user_id: 'user-b',
    });
    expect(items.eq).toHaveBeenCalledWith('manufacturer_id', 'brand-1');
    expect(items.eq).not.toHaveBeenCalledWith('user_id', 'user-b');
    expect(items.or).toHaveBeenCalledWith('vehicle_type.is.null,vehicle_type.eq.');
    expect(body.items).toEqual([
      expect.objectContaining({
        reference: '50402',
        missing: ['vehicle_type'],
        has_image: true,
      }),
    ]);
    expect(body.pagination).toMatchObject({ total: 1, page: 1, limit: 25 });
  });

  test('la actualización escribe solo los campos enviados y no vacía los demás', async () => {
    const updates = [];
    const brands = builder({ data: [{ id: 'brand-1' }], error: null });
    const items = builder({ data: [{ id: 'item-1' }], error: null });
    items.update = jest.fn((row) => {
      updates.push(row);
      return items;
    });
    getServiceClient.mockReturnValue(client({
      email: ADMIN_EMAIL,
      from: jest.fn((table) => (table === 'slot_catalog_brands' ? brands : items)),
    }));
    const body = await updateCatalogItem(USER, {
      reference: '50402',
      manufacturer: 'Avant Slot',
      model_name: 'Porsche 911',
      traction: '   ',
      motor_position: 'transversal',
      commercial_release_year: '',
    });
    expect(body.updated).toEqual({ model_name: 'Porsche 911', motor_position: 'transverse' });
    expect(updates[0]).toMatchObject({ model_name: 'Porsche 911', motor_position: 'transverse' });
    expect(updates[0].traction).toBeUndefined();
    expect(updates[0].commercial_release_year).toBeUndefined();
    expect(updates[0].image_url).toBeUndefined();
    expect(updates[0].reference).toBeUndefined();
  });

  test('un motor inválido responde 400 y no escribe', async () => {
    const from = jest.fn();
    getServiceClient.mockReturnValue(client({ email: ADMIN_EMAIL, from }));
    await expect(updateCatalogItem(USER, {
      reference: '50402',
      manufacturer: 'Avant Slot',
      motor_position: 'lateral',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(from).not.toHaveBeenCalled();
  });

  test('el menú de admin nombra las herramientas de catálogo y el de una cuenta normal no', () => {
    const normal = listCapabilities(USER, {}, { isAdmin: false });
    const admin = listCapabilities(USER, {}, { isAdmin: true });
    const names = (menu) => menu.groups.flatMap((group) => group.options.map((option) => option.tool));
    expect(names(normal)).not.toEqual(expect.arrayContaining([
      'list_incomplete_catalog_items',
      'update_catalog_item',
    ]));
    expect(names(admin)).toEqual(expect.arrayContaining([
      'list_incomplete_catalog_items',
      'update_catalog_item',
    ]));
    expect(admin.cannot.join(' ')).not.toMatch(/No lista ni busca el catálogo/);
    expect(normal.cannot.join(' ')).toMatch(/No lista ni busca el catálogo/);
  });
});
