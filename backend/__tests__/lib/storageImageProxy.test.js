// Estas pruebas simulan la función de Vercel (process.env.VERCEL).
process.env.VERCEL = process.env.VERCEL || '1';
const handler = require('../../../frontend/api/img');
const {
  allowImgRateLimit,
  allowImgHotlink,
  resetImgAccessControlForTests,
} = require('../../../frontend/api/_lib/imgAccessControl');
const { signR2GetRequest } = require('../../../frontend/api/_lib/r2Fetch');
const crypto = require('crypto');
const { SignatureV4 } = require('@smithy/signature-v4');

class NodeSha256 {
  constructor(secret) {
    this.hash = secret ? crypto.createHmac('sha256', Buffer.from(secret)) : crypto.createHash('sha256');
  }

  update(data) {
    this.hash.update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data));
  }

  async digest() {
    return new Uint8Array(this.hash.digest());
  }
}

const R2_READ_ENV = {
  R2_ACCOUNT_ID: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'slot-images',
};

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('api/img proxy', () => {
  const env = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...env,
      REACT_APP_SUPABASE_URL: 'https://abcdxyz.supabase.co',
    };
    delete process.env.BLOCKED_IPS;
    resetImgAccessControlForTests();
  });

  afterEach(() => {
    process.env = env;
    global.fetch = originalFetch;
  });

  test('GET permitido cachea bytes y no sigue redirects', async () => {
    const bytes = Buffer.from('webp-bytes');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          const h = {
            'content-type': 'image/webp',
            'content-length': String(bytes.length),
            etag: '"abc"',
          };
          return h[name] || null;
        },
      },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });

    const res = mockRes();
    await handler(
      { method: 'GET', query: { p: 'catalog-images/catalog/1710000000-ab12cd.webp' } },
      res,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp',
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/webp');
    expect(res.headers['Cache-Control']).toContain('immutable');
    expect(res.headers['Cache-Control']).toContain('s-maxage=31536000');
    expect(res.headers['CDN-Cache-Control']).toContain('max-age=31536000');
    expect(res.headers['CDN-Cache-Control']).toContain('s-maxage=31536000');
    expect(res.headers['Vercel-CDN-Cache-Control']).toContain('immutable');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.toString()).toBe('webp-bytes');
  });

  test('rechaza método y URL no allowlisteada', async () => {
    const resPost = mockRes();
    await handler({ method: 'POST', query: {} }, resPost);
    expect(resPost.statusCode).toBe(405);

    const resBad = mockRes();
    await handler(
      { method: 'GET', query: { u: 'https://evil.example/storage/v1/object/public/catalog-images/x.webp' } },
      resBad,
    );
    expect(resBad.statusCode).toBe(400);
    expect(global.fetch).toBe(originalFetch);
  });

  test('403 ante hotlink cruzado; referer vacío y Googlebot pasan', async () => {
    const blocked = mockRes();
    await handler(
      {
        method: 'GET',
        query: { p: 'catalog-images/catalog/a.webp' },
        headers: {
          referer: 'https://evil.example/gallery',
          'sec-fetch-site': 'cross-site',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
      },
      blocked,
    );
    expect(blocked.statusCode).toBe(403);
    expect(global.fetch).toBe(originalFetch);

    const emptyRef = allowImgHotlink({
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });
    expect(emptyRef).toEqual({ ok: true });

    const google = allowImgHotlink({
      headers: {
        'user-agent': 'Googlebot-Image/1.0',
        referer: 'https://www.google.com/',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(google).toEqual({ ok: true });
  });

  test('rate limit por IP con ráfaga; Googlebot no consume cupo', () => {
    const env = {
      IMG_RATE_LIMIT_BURST_WINDOW_MS: '1000',
      IMG_RATE_LIMIT_BURST_MAX: '3',
      IMG_RATE_LIMIT_WINDOW_MS: '60000',
      IMG_RATE_LIMIT_MAX: '10',
    };
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.50',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    };
    expect(allowImgRateLimit(req, env).ok).toBe(true);
    expect(allowImgRateLimit(req, env).ok).toBe(true);
    expect(allowImgRateLimit(req, env).ok).toBe(true);
    const limited = allowImgRateLimit(req, env);
    expect(limited.ok).toBe(false);
    expect(limited.status).toBe(429);
    expect(limited.retryAfterSec).toBeGreaterThanOrEqual(1);

    const bot = {
      headers: { 'x-forwarded-for': '203.0.113.50', 'user-agent': 'Googlebot/2.1' },
    };
    expect(allowImgRateLimit(bot, env).ok).toBe(true);
  });

  test('BLOCKED_IPS responde 403 en /api/img sin ir a Storage', async () => {
    process.env.BLOCKED_IPS = '90.94.193.52';
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        query: { p: 'catalog-images/catalog/a.webp' },
        headers: { 'x-forwarded-for': '90.94.193.52' },
      },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(String(res.body)).toMatch(/Forbidden/i);
    expect(global.fetch).toBe(originalFetch);

    process.env.BLOCKED_IPS = '10.0.0.1';
    const allowed = mockRes();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name === 'content-type' ? 'image/webp' : null;
        },
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    await handler(
      {
        method: 'GET',
        query: { p: 'catalog-images/catalog/a.webp' },
        headers: { 'x-forwarded-for': '90.94.193.52' },
      },
      allowed,
    );
    expect(allowed.statusCode).toBe(200);
  });

  test('/api/img/r2/... lee del bucket privado de R2 con petición firmada', async () => {
    Object.assign(process.env, R2_READ_ENV);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name === 'content-type' ? 'image/webp' : null;
        },
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const res = mockRes();
    await handler(
      { method: 'GET', query: { p: 'r2/vehicle-images/vehicles/u1/1790000000-front.webp' } },
      res,
    );
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(
      'https://a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.r2.cloudflarestorage.com/slot-images/vehicle-images/vehicles/u1/1790000000-front.webp',
    );
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect(init.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3\/aws4_request, /);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toContain('immutable');
  });

  test('la firma SigV4 de R2 coincide con la del SDK de AWS', async () => {
    const now = new Date('2026-11-24T08:30:15.123Z');
    const cfg = { accountId: 'acc123', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG', bucket: 'slot-images' };
    const ours = signR2GetRequest(cfg, 'catalog-images', 'catalog/1790000000-ab12cd-thumb.webp', now);

    const signer = new SignatureV4({
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      region: 'auto',
      service: 's3',
      sha256: NodeSha256,
      uriEscapePath: false,
    });
    const sdk = await signer.sign(
      {
        method: 'GET',
        protocol: 'https:',
        hostname: 'acc123.r2.cloudflarestorage.com',
        path: '/slot-images/catalog-images/catalog/1790000000-ab12cd-thumb.webp',
        headers: {
          host: 'acc123.r2.cloudflarestorage.com',
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        },
      },
      { signingDate: now },
    );

    expect(ours.url).toBe(
      'https://acc123.r2.cloudflarestorage.com/slot-images/catalog-images/catalog/1790000000-ab12cd-thumb.webp',
    );
    expect(ours.headers['x-amz-date']).toBe(sdk.headers['x-amz-date']);
    expect(ours.headers.authorization).toBe(sdk.headers.authorization);
  });

  test('/api/img/r2/... devuelve 404 si el objeto no existe en R2', async () => {
    Object.assign(process.env, R2_READ_ENV);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } });
    const res = mockRes();
    await handler({ method: 'GET', query: { p: 'r2/catalog-images/catalog/missing.webp' } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('/api/img/r2/... sin R2 configurado responde 503 sin fetch', async () => {
    for (const k of Object.keys(R2_READ_ENV)) delete process.env[k];
    const res = mockRes();
    await handler({ method: 'GET', query: { p: 'r2/catalog-images/catalog/a.webp' } }, res);
    expect(res.statusCode).toBe(503);
    expect(global.fetch).toBe(originalFetch);
  });

  test('rechaza path traversal y buckets ajenos sin fetch', async () => {
    const resTrav = mockRes();
    await handler({ method: 'GET', query: { p: 'catalog-images/../secret/x.webp' } }, resTrav);
    expect(resTrav.statusCode).toBe(400);

    const resBucket = mockRes();
    await handler({ method: 'GET', query: { p: 'secret-bucket/x.webp' } }, resBucket);
    expect(resBucket.statusCode).toBe(400);
    expect(global.fetch).toBe(originalFetch);
  });
});
