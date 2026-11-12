const {
  buildShopOfferReport,
  publicShopOfferResult,
  sendShopOfferReport,
} = require('../../lib/shopOfferReport');

describe('shopOfferReport', () => {
  const originalEnv = process.env;
  const now = new Date('2026-11-04T06:00:00.000Z');
  const summary = {
    shops: 5,
    skipped_shops: 1,
    skipped: [{
      name: 'Slot Norte',
      adapter_key: 'slot-norte',
      reason: 'No hay adaptador registrado para «slot-norte»',
    }],
    checked: 17,
    discovered: 182,
    out_of_stock: 266,
    errors: 0,
    created: [{
      shop: 'Evotec',
      catalog_item_id: 'item-1',
      reference: 'C4034',
      model_name: 'Ford Escort',
      manufacturer: 'Scalextric',
      product_url: 'https://evotecshop.com/en/turismos/1-escort.html',
      in_stock: true,
    }],
    withdrawn: [{
      shop: 'Trofeslot',
      catalog_item_id: 'item-2',
      reference: 'RS0139',
      model_name: 'Mitsubishi',
      manufacturer: 'Superslot',
      product_url: 'https://trofeslot.com/producto/chasis/',
    }],
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM = 'Slot Database <hello@example.com>';
    process.env.FRONTEND_URL = 'https://www.slotdatabase.es';
    process.env.SHOP_OFFER_REPORT_TO = 'adrianpalomera17@gmail.com';
  });

  afterEach(() => {
    process.env = originalEnv;
    delete global.fetch;
  });

  test('el correo lista altas, bajas y la tienda omitida', () => {
    const mail = buildShopOfferReport({ summary, now });
    expect(mail.subject).toBe('Ofertas de tienda: 1 nueva, 1 retirada · 1 tienda omitida');
    expect(mail.html).toContain('lang="es"');
    expect(mail.html).toContain('C4034');
    expect(mail.html).toContain('RS0139');
    expect(mail.html).toContain('No hay adaptador registrado para «slot-norte»');
    expect(mail.html).toContain('https://www.slotdatabase.es/catalogo/item-1');
    expect(mail.text).toContain('Ford Escort');
    expect(mail.text).toContain('Slot Norte');
  });

  test('envía el informe a Resend con clave de idempotencia', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock;

    const sent = await sendShopOfferReport({ summary, now });

    expect(sent).toMatchObject({ ok: true, to: ['adrianpalomera17@gmail.com'] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers['Idempotency-Key']).toBe('shop-offer-report/2026-11-04T06:00:00.000Z');
    expect(options.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(options.body);
    expect(body.from).toBe('Slot Database <hello@example.com>');
    expect(body.to).toEqual(['adrianpalomera17@gmail.com']);
    expect(body.subject).toContain('1 nueva');
  });

  test('sin API key no envía y la respuesta conserva el detalle', async () => {
    delete process.env.RESEND_API_KEY;
    global.fetch = jest.fn();

    const sent = await sendShopOfferReport({ summary, now });
    const body = publicShopOfferResult(summary, sent);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(sent.reason).toBe('no_resend_key');
    expect(body.email_sent).toBe(false);
    expect(body.created).toBe(1);
    expect(body.created_items[0].reference).toBe('C4034');
    expect(body.withdrawn_items[0].reference).toBe('RS0139');
    expect(body.skipped[0].adapter_key).toBe('slot-norte');
  });

  test('si el correo sale, la respuesta no repite los listados', () => {
    const body = publicShopOfferResult(summary, { ok: true, to: ['adrianpalomera17@gmail.com'] });
    expect(body.email_sent).toBe(true);
    expect(body.created).toBe(1);
    expect(body.withdrawn).toBe(1);
    expect(body.created_items).toBeUndefined();
    expect(body.skipped[0].reason).toContain('slot-norte');
  });
});