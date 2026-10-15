const handler = require('../../../frontend/api/img');
const {
  allowImgRateLimit,
  allowImgHotlink,
  resetImgAccessControlForTests,
} = require('../../../frontend/api/_lib/imgAccessControl');

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
