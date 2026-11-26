const { shouldNotifyWatch, matchOfferToWatches } = require('../../lib/priceWatchMatch');

const offer = {
  id: 'offer-1',
  shop_id: 'shop-1',
  catalog_item_id: 'item-1',
  price: 30,
  currency: 'EUR',
  in_stock: true,
};

const watch = {
  id: 'watch-1',
  user_id: 'user-1',
  catalog_item_id: 'item-1',
  max_price: 40,
  currency: 'EUR',
};

function fakeAdmin({ watches = [], notices = [], inserted }) {
  return {
    from(table) {
      const api = {
        select() { return api; },
        eq() { return api; },
        gte() { return api; },
        in() { return api; },
        order() { return api; },
        insert(row) {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
        then(onFulfilled, onRejected) {
          const data = table === 'catalog_price_watches' ? watches : notices;
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
        },
      };
      return api;
    },
  };
}

describe('shouldNotifyWatch', () => {
  test('avisa la primera vez que el precio cabe en el tope', () => {
    expect(shouldNotifyWatch({
      inStock: true,
      price: 40,
      currency: 'EUR',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: null,
    })).toBe(true);
  });

  test('no repite el mismo precio', () => {
    expect(shouldNotifyWatch({
      inStock: true,
      price: 30,
      currency: 'EUR',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: 30,
    })).toBe(false);
  });

  test('avisa si la tienda baja más', () => {
    expect(shouldNotifyWatch({
      inStock: true,
      price: 28.5,
      currency: 'EUR',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: '30.00',
    })).toBe(true);
  });

  test('no avisa por encima del tope, sin stock o en otra moneda', () => {
    expect(shouldNotifyWatch({
      inStock: true,
      price: 41,
      currency: 'EUR',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: null,
    })).toBe(false);
    expect(shouldNotifyWatch({
      inStock: false,
      price: 10,
      currency: 'EUR',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: null,
    })).toBe(false);
    expect(shouldNotifyWatch({
      inStock: true,
      price: 10,
      currency: 'GBP',
      maxPrice: 40,
      watchCurrency: 'EUR',
      lastNotifiedPrice: null,
    })).toBe(false);
  });
});

describe('matchOfferToWatches', () => {
  test('sin stock no consulta búsquedas', async () => {
    const admin = { from: jest.fn() };
    await expect(matchOfferToWatches(admin, { ...offer, in_stock: false })).resolves.toEqual([]);
    expect(admin.from).not.toHaveBeenCalled();
  });

  test('crea un aviso la primera vez y no lo repite al mismo precio', async () => {
    const inserted = [];
    const admin = fakeAdmin({ watches: [watch], notices: [], inserted });
    await expect(matchOfferToWatches(admin, offer, { shopName: 'Evotec' })).resolves.toEqual(['watch-1']);
    expect(inserted).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        watch_id: 'watch-1',
        shop_name: 'Evotec',
        price: 30,
        currency: 'EUR',
      }),
    ]);

    const again = [];
    const repeat = fakeAdmin({
      watches: [watch],
      notices: [{ watch_id: 'watch-1', shop_id: 'shop-1', price: 30, created_at: '2026-11-01T00:00:00.000Z' }],
      inserted: again,
    });
    await expect(matchOfferToWatches(repeat, offer)).resolves.toEqual([]);
    expect(again).toEqual([]);
  });

  test('crea otro aviso si el precio baja', async () => {
    const inserted = [];
    const admin = fakeAdmin({
      watches: [watch],
      notices: [{ watch_id: 'watch-1', shop_id: 'shop-1', price: 35, created_at: '2026-11-01T00:00:00.000Z' }],
      inserted,
    });
    await expect(matchOfferToWatches(admin, offer)).resolves.toEqual(['watch-1']);
    expect(inserted[0].price).toBe(30);
  });
});
