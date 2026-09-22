const handler = require('../../../frontend/api/img');

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
    expect(res.headers['CDN-Cache-Control']).toContain('max-age=31536000');
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
});
