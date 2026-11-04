const { createShortCode, ALPHABET } = require('../../lib/shortCode');
const { isPublicOffer, nextOfferPrices, runShopOfferBatch, runShopOfferLookup } = require('../../lib/shopOfferSync');
const { resolveGoTarget } = require('../../lib/goTarget');
const { validateShopInput } = require('../../lib/shopInput');
const { registerAdapter, clearAdapters, getAdapter } = require('../../lib/shopAdapters');
const testAdapter = require('../../lib/shopAdapters/testAdapter');
const { fetchShopPage, SHOP_USER_AGENT } = require('../../lib/shopAdapters/fetchShopPage');

describe('shortCode', () => {
  test('tiene 7 caracteres del alfabeto legible', () => {
    const code = createShortCode(() => Buffer.from([0, 1, 2, 3, 4, 5, 6]));
    expect(code).toHaveLength(7);
    for (const char of code) expect(ALPHABET).toContain(char);
    expect(code).not.toMatch(/[01Ol]/);
  });
});

describe('isPublicOffer', () => {
  const now = new Date('2026-11-04T12:00:00.000Z');
  const shop = { active: true };

  test('exige stock, tienda activa y revisión de los últimos 8 días', () => {
    expect(isPublicOffer({
      in_stock: true,
      last_checked_at: '2026-11-01T12:00:00.000Z',
    }, shop, now)).toBe(true);

    expect(isPublicOffer({
      in_stock: false,
      last_checked_at: '2026-11-04T11:00:00.000Z',
    }, shop, now)).toBe(false);

    expect(isPublicOffer({
      in_stock: true,
      last_checked_at: '2026-10-01T12:00:00.000Z',
    }, shop, now)).toBe(false);

    expect(isPublicOffer({
      in_stock: true,
      last_checked_at: '2026-11-04T11:00:00.000Z',
    }, { active: false }, now)).toBe(false);
  });
});

describe('resolveGoTarget', () => {
  const now = new Date('2026-11-04T12:00:00.000Z');

  test('cuenta el clic y sale a la tienda si hay stock reciente', () => {
    const target = resolveGoTarget({
      offer: {
        catalog_item_id: 'item-1',
        product_url: 'https://shop.example/p/1',
        in_stock: true,
        last_checked_at: '2026-11-03T12:00:00.000Z',
      },
      shop: { active: true },
      now,
      frontendBase: 'https://www.slotdatabase.es',
    });
    expect(target).toEqual({
      redirect: 'https://shop.example/p/1',
      recordClick: true,
    });
  });

  test('sin stock no cuenta el clic y vuelve a la ficha', () => {
    const target = resolveGoTarget({
      offer: {
        catalog_item_id: 'item-1',
        product_url: 'https://shop.example/p/1',
        in_stock: false,
        last_checked_at: '2026-11-03T12:00:00.000Z',
      },
      shop: { active: true },
      now,
      frontendBase: 'https://www.slotdatabase.es/',
    });
    expect(target).toEqual({
      redirect: 'https://www.slotdatabase.es/catalogo/item-1',
      recordClick: false,
    });
  });
});

describe('validateShopInput', () => {
  test('exige nombre, país y adaptador', () => {
    const bad = validateShopInput({ name: '  ', country_code: 'es', adapter_key: '' });
    expect(bad.ok).toBe(false);

    const ok = validateShopInput({
      name: ' Slot Norte ',
      country_code: 'es',
      adapter_key: 'slot-norte',
      logo_url: 'https://cdn.example/logo.png',
      site_url: '',
    });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({
      name: 'Slot Norte',
      country_code: 'ES',
      adapter_key: 'slot-norte',
      logo_url: 'https://cdn.example/logo.png',
      site_url: null,
      currency: 'EUR',
      active: true,
    });
  });
});

describe('runShopOfferBatch', () => {
  beforeEach(() => {
    clearAdapters();
    registerAdapter(testAdapter);
  });

  afterEach(() => clearAdapters());

  test('marca sin stock, no toca last_checked_at si la tienda falla, y descubre por referencia', async () => {
    const updates = [];
    const inserts = [];
    const cursors = [];
    const io = {
      listActiveShops: async () => ([
        {
          id: 'shop-1',
          name: 'Evotec',
          adapter_key: 'test',
          currency: 'EUR',
          active: true,
          discover_after_id: null,
        },
        {
          id: 'shop-2',
          name: 'Slot Norte',
          adapter_key: 'desconocido',
          currency: 'EUR',
          active: true,
          discover_after_id: null,
        },
      ]),
      listOffersToRecheck: async () => ([
        {
          id: 'off-ok',
          shop_id: 'shop-1',
          catalog_item_id: 'item-ok',
          product_url: 'https://shop.example/p/live',
          in_stock: false,
          slot_catalog_items: { reference: 'LIVE1', model_name: 'Porsche', manufacturer: 'Scalextric' },
        },
        {
          id: 'off-oos',
          shop_id: 'shop-1',
          catalog_item_id: 'item-oos',
          product_url: 'https://shop.example/p/oos',
          in_stock: true,
          slot_catalog_items: { reference: 'OOS1', model_name: 'Audi', manufacturer: 'Slot.it' },
        },
        { id: 'off-fail', shop_id: 'shop-1', product_url: 'https://shop.example/p/fail', in_stock: true },
        {
          id: 'off-gone',
          shop_id: 'shop-1',
          catalog_item_id: 'item-gone',
          product_url: 'https://shop.example/p/gone',
          in_stock: true,
          slot_catalog_items: { reference: 'GONE1' },
        },
      ]),
      updateOffer: async (id, patch) => { updates.push({ id, patch }); },
      listCatalogItems: async () => ([
        { id: 'item-1', reference: 'C4034', ean: null, brand: 'Scalextric' },
        { id: 'item-2', reference: 'MISS', ean: null, brand: 'Scalextric' },
      ]),
      findOffer: async () => null,
      insertOffer: async (row) => { inserts.push(row); },
      setDiscoverCursor: async (shopId, cursor) => { cursors.push({ shopId, cursor }); },
    };

    const summary = await runShopOfferBatch({
      io,
      getAdapter,
      now: new Date('2026-11-04T12:00:00.000Z'),
      discoverPerShop: 20,
      pauseMs: 0,
      newShortCode: () => 'Ab3kX9p',
    });

    expect(summary.skipped_shops).toBe(1);
    expect(summary.shops).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.discovered).toBe(1);

    const byId = Object.fromEntries(updates.map((row) => [row.id, row.patch]));
    expect(byId['off-ok']).toMatchObject({ in_stock: true, price: 21.5, last_check_error: null });
    expect(byId['off-oos']).toMatchObject({ in_stock: false });
    expect(byId['off-gone']).toMatchObject({ in_stock: false });
    expect(byId['off-fail'].last_check_error).toBe('timeout');
    expect(byId['off-fail'].last_checked_at).toBeUndefined();
    expect(byId['off-fail'].in_stock).toBeUndefined();

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      shop_id: 'shop-1',
      catalog_item_id: 'item-1',
      in_stock: true,
      short_code: 'Ab3kX9p',
      product_url: 'https://shop.example/p/C4034',
    });
    expect(cursors).toEqual([
      { shopId: 'shop-1', cursor: null },
    ]);
    expect(summary.skipped).toEqual([{
      name: 'Slot Norte',
      adapter_key: 'desconocido',
      reason: 'No hay adaptador registrado para «desconocido»',
    }]);
    expect(summary.created).toEqual([expect.objectContaining({
      shop: 'Evotec',
      catalog_item_id: 'item-1',
      reference: 'C4034',
      manufacturer: 'Scalextric',
      in_stock: true,
    })]);
    expect(summary.withdrawn.map((row) => row.reference).sort()).toEqual(['GONE1', 'OOS1']);
  });
});

describe('nextOfferPrices', () => {
  test('guarda el precio anterior solo cuando el nuevo es más bajo', () => {
    expect(nextOfferPrices({
      price: 67.5,
      regularPrice: 75,
      existingPrice: 80,
      existingPrevious: null,
    })).toEqual({ price: 67.5, previous_price: 75 });

    expect(nextOfferPrices({
      price: 70,
      existingPrice: 80,
      existingPrevious: null,
    })).toEqual({ price: 70, previous_price: 80 });

    expect(nextOfferPrices({
      price: 90,
      existingPrice: 80,
      existingPrevious: 100,
    })).toEqual({ price: 90, previous_price: null });

    expect(nextOfferPrices({
      price: 70,
      existingPrice: 70,
      existingPrevious: 80,
    })).toEqual({ price: 70, previous_price: 80 });
  });
});

describe('runShopOfferBatch listing', () => {
  afterEach(() => clearAdapters());

  test('lee el listado completo y marca ausentes como sin stock', async () => {
    clearAdapters();
    registerAdapter({
      key: 'woo-test',
      async listProducts() {
        return [
          {
            sku: 'Referencia: C4034',
            productUrl: 'https://shop.example/p/C4034',
            price: 10,
            regularPrice: 12,
            currency: 'EUR',
            inStock: true,
          },
          {
            sku: 'OLD1',
            productUrl: 'https://shop.example/p/old',
            price: 8,
            currency: 'EUR',
            inStock: false,
          },
        ];
      },
      async findByReference() {
        throw new Error('no buscar por referencia');
      },
      async checkProduct() {
        throw new Error('no recheck html');
      },
    });

    const updates = [];
    const inserts = [];
    const io = {
      listActiveShops: async () => ([{
        id: 'shop-woo',
        adapter_key: 'woo-test',
        currency: 'EUR',
        active: true,
        discover_after_id: null,
      }]),
      listOffersToRecheck: async () => {
        throw new Error('el listado no recomprueba ficha a ficha');
      },
      listCatalogItems: async () => {
        throw new Error('el listado no descubre de 20 en 20');
      },
      listCatalogReferences: async () => ([
        { id: 'item-1', reference: 'C4034' },
        { id: 'item-2', reference: 'OLD1' },
        { id: 'item-3', reference: 'AUSENTE' },
      ]),
      listShopOffers: async () => ([
        { id: 'off-1', catalog_item_id: 'item-1', price: 15, previous_price: null, in_stock: true },
        { id: 'off-3', catalog_item_id: 'item-3', price: 20, previous_price: null, in_stock: true },
      ]),
      findOffer: async (_shopId, itemId) => (
        itemId === 'item-1'
          ? { id: 'off-1', price: 15, previous_price: null }
          : null
      ),
      updateOffer: async (id, patch) => { updates.push({ id, patch }); },
      insertOffer: async (row) => { inserts.push(row); },
      setDiscoverCursor: async () => { throw new Error('no mueve el cursor'); },
    };

    const summary = await runShopOfferBatch({
      io,
      getAdapter,
      now: new Date('2026-11-04T12:00:00.000Z'),
      newShortCode: () => 'Ab3kX9p',
    });

    expect(summary).toMatchObject({ discovered: 1, out_of_stock: 2, errors: 0 });
    const byId = Object.fromEntries(updates.map((row) => [row.id, row.patch]));
    expect(byId['off-1']).toMatchObject({ price: 10, previous_price: 12, in_stock: true });
    expect(byId['off-3']).toMatchObject({ in_stock: false });
    expect(inserts[0]).toMatchObject({
      catalog_item_id: 'item-2',
      price: 8,
      previous_price: null,
      in_stock: false,
    });
  });

  test('un listado vacío no da por agotado el resto', async () => {
    clearAdapters();
    registerAdapter({
      key: 'woo-test',
      async listProducts() {
        return [];
      },
      async findByReference() {
        return null;
      },
      async checkProduct() {
        return null;
      },
    });
    const io = {
      listActiveShops: async () => ([{
        id: 'shop-woo',
        adapter_key: 'woo-test',
        currency: 'EUR',
        active: true,
      }]),
      listOffersToRecheck: async () => [],
      listShopOffers: async () => {
        throw new Error('no debe marcar ausencias');
      },
    };

    const summary = await runShopOfferBatch({ io, getAdapter });
    expect(summary.errors).toBe(1);
    expect(summary.out_of_stock).toBe(0);
  });
});

describe('runShopOfferLookup', () => {
  test('un coche descatalogado no se busca en las tiendas', async () => {
    const io = {
      findCatalogItemByReference: async () => ({
        id: 'item-1',
        reference: 'C4545',
        ean: null,
        brand: null,
        discontinued: true,
      }),
      listActiveShops: async () => {
        throw new Error('no debería listar tiendas');
      },
    };

    const summary = await runShopOfferLookup({
      io,
      getAdapter,
      reference: 'C4545',
    });

    expect(summary).toMatchObject({
      found: true,
      discontinued: true,
      shops: 0,
      matched: 0,
    });
  });
});

describe('fetchShopPage', () => {
  test('404 es ausencia y el user-agent es el del catálogo', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ status: 404, ok: false, text: async () => '' })
      .mockResolvedValueOnce({ status: 200, ok: true, text: async () => '<html>ok</html>' });

    await expect(fetchShopPage('https://shop.example/missing', { fetchImpl })).resolves.toBeNull();
    await expect(fetchShopPage('https://shop.example/p', { fetchImpl })).resolves.toBe('<html>ok</html>');
    expect(fetchImpl.mock.calls[0][1].headers['user-agent']).toBe(SHOP_USER_AGENT);
  });

  test('un 500 es un fallo, no un sin stock', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 500, ok: false, text: async () => '' });
    await expect(fetchShopPage('https://shop.example/p', { fetchImpl })).rejects.toThrow('HTTP 500');
  });

  test('un 403 de Node se reintenta con curl', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 403, ok: false, text: async () => 'blocked' });
    const curlImpl = jest.fn().mockResolvedValue({ status: 200, body: '<html>curl</html>' });
    await expect(fetchShopPage('https://shop.example/p', { fetchImpl, curlImpl })).resolves.toBe('<html>curl</html>');
    expect(curlImpl).toHaveBeenCalledWith('https://shop.example/p', 12000);
  });
});
