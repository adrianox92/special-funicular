jest.mock('../../lib/supabaseClients', () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { getServiceClient } = require('../../lib/supabaseClients');
const goRoute = require('../../routes/go');

function buildApp() {
  const app = express();
  app.use('/api/go', goRoute);
  return app;
}

function mockDb({ offer, insert }) {
  getServiceClient.mockReturnValue({
    from(table) {
      if (table === 'catalog_shop_offers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: offer, error: null }),
            }),
          }),
        };
      }
      if (table === 'catalog_shop_offer_clicks') {
        return { insert };
      }
      throw new Error(`tabla inesperada ${table}`);
    },
  });
}

describe('GET /api/go/:code', () => {
  const prevFrontend = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://www.slotdatabase.es';
  });

  afterAll(() => {
    process.env.FRONTEND_URL = prevFrontend;
  });

  test('con stock redirige a la tienda y registra el clic', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    mockDb({
      insert,
      offer: {
        id: 'offer-1',
        catalog_item_id: 'item-1',
        product_url: 'https://shop.example/p/1',
        in_stock: true,
        last_checked_at: new Date().toISOString(),
        catalog_shops: { id: 'shop-1', active: true },
      },
    });

    const res = await request(buildApp()).get('/api/go/Ab3kX9p');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://shop.example/p/1');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ offer_id: 'offer-1' }),
    ]);
  });

  test('sin stock no registra el clic y vuelve a la ficha', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    mockDb({
      insert,
      offer: {
        id: 'offer-1',
        catalog_item_id: 'item-1',
        product_url: 'https://shop.example/p/1',
        in_stock: false,
        last_checked_at: new Date().toISOString(),
        catalog_shops: { id: 'shop-1', active: true },
      },
    });

    const res = await request(buildApp()).get('/api/go/Ab3kX9p');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://www.slotdatabase.es/catalogo/item-1');
    expect(insert).not.toHaveBeenCalled();
  });

  test('un código inválido va al catálogo', async () => {
    const res = await request(buildApp()).get('/api/go/no');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://www.slotdatabase.es/catalogo');
  });
});
