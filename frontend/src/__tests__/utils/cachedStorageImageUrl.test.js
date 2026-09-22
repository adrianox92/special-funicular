const {
  cachedStorageImageUrl,
  parseAllowedStorageUrl,
  resolveStorageImageRequest,
  pathSegmentsFromReq,
  allowedStorageHostsFromEnv,
  isSafeObjectPath,
} = require('../../utils/cachedStorageImageUrl');

const CATALOG =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';
const VEHICLE =
  'https://abcdxyz.supabase.co/storage/v1/object/public/vehicle-images/vehicles/u1/front.webp';

describe('parseAllowedStorageUrl', () => {
  test('acepta bucket de catálogo y de vehículos', () => {
    expect(parseAllowedStorageUrl(CATALOG)).toMatchObject({
      bucket: 'catalog-images',
      objectPath: 'catalog/1710000000-ab12cd.webp',
    });
    expect(parseAllowedStorageUrl(VEHICLE)).toMatchObject({
      bucket: 'vehicle-images',
      objectPath: 'vehicles/u1/front.webp',
    });
  });

  test('rechaza host no supabase, bucket ajeno y path inseguro', () => {
    expect(parseAllowedStorageUrl('https://cdn.example/p911.jpg')).toBeNull();
    expect(
      parseAllowedStorageUrl(
        'https://abcdxyz.supabase.co/storage/v1/object/public/secret-bucket/x.webp',
      ),
    ).toBeNull();
    expect(
      parseAllowedStorageUrl(
        'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/../etc/passwd',
      ),
    ).toBeNull();
  });

  test('respeta allowlist de hosts cuando se pasa', () => {
    const allowed = new Set(['abcdxyz.supabase.co']);
    expect(parseAllowedStorageUrl(CATALOG, { allowedHosts: allowed })).not.toBeNull();
    expect(
      parseAllowedStorageUrl(
        'https://other.supabase.co/storage/v1/object/public/catalog-images/catalog/a.webp',
        { allowedHosts: allowed },
      ),
    ).toBeNull();
  });
});

describe('cachedStorageImageUrl', () => {
  test('reescribe Storage a /api/img y conserva blob/data/relativas', () => {
    expect(cachedStorageImageUrl(CATALOG)).toBe(
      '/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
    );
    expect(cachedStorageImageUrl(CATALOG, { origin: 'https://www.slotdatabase.es/' })).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
    );
    expect(cachedStorageImageUrl('blob:https://www.slotdatabase.es/abc')).toBe(
      'blob:https://www.slotdatabase.es/abc',
    );
    expect(cachedStorageImageUrl('data:image/png;base64,xx')).toBe('data:image/png;base64,xx');
    expect(cachedStorageImageUrl('/logo512.png')).toBe('/logo512.png');
    expect(cachedStorageImageUrl('https://cdn.example/p911.jpg')).toBe('https://cdn.example/p911.jpg');
    expect(cachedStorageImageUrl('')).toBe('');
    expect(cachedStorageImageUrl(null)).toBe('');
  });

  test('un image_url nuevo (otro path) cambia la clave de caché', () => {
    const next =
      'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000999-zz99.webp';
    expect(cachedStorageImageUrl(CATALOG)).not.toBe(cachedStorageImageUrl(next));
  });

  test('enabled:false deja la URL original (dev local)', () => {
    expect(cachedStorageImageUrl(CATALOG, { enabled: false })).toBe(CATALOG);
  });
});

describe('resolveStorageImageRequest', () => {
  const env = { REACT_APP_SUPABASE_URL: 'https://abcdxyz.supabase.co' };

  test('reconstruye desde path y valida query u', () => {
    expect(
      resolveStorageImageRequest({
        pathSegments: ['catalog-images', 'catalog', '1710000000-ab12cd.webp'],
        env,
      }),
    ).toEqual({
      ok: true,
      sourceUrl: CATALOG,
      bucket: 'catalog-images',
      objectPath: 'catalog/1710000000-ab12cd.webp',
    });

    expect(resolveStorageImageRequest({ queryUrl: CATALOG, env })).toMatchObject({
      ok: true,
      sourceUrl: CATALOG,
    });
  });

  test('503 si falta origen; 400 si path o host no permitidos', () => {
    expect(
      resolveStorageImageRequest({
        pathSegments: ['catalog-images', 'catalog', 'a.webp'],
        env: {},
      }),
    ).toMatchObject({ ok: false, status: 503 });

    expect(
      resolveStorageImageRequest({
        pathSegments: ['other-bucket', 'x.webp'],
        env,
      }),
    ).toMatchObject({ ok: false, status: 400 });

    expect(
      resolveStorageImageRequest({
        queryUrl: 'https://evil.example/storage/v1/object/public/catalog-images/x.webp',
        env,
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  test('STORAGE_IMAGE_ALLOWED_HOSTS añade hosts extra', () => {
    const hosts = allowedStorageHostsFromEnv({
      REACT_APP_SUPABASE_URL: 'https://abcdxyz.supabase.co',
      STORAGE_IMAGE_ALLOWED_HOSTS: 'cdn.slotdatabase.es',
    });
    expect(hosts.has('abcdxyz.supabase.co')).toBe(true);
    expect(hosts.has('abcdxyz.storage.supabase.co')).toBe(true);
    expect(hosts.has('cdn.slotdatabase.es')).toBe(true);
  });
});

describe('pathSegmentsFromReq / isSafeObjectPath', () => {
  test('lee p, path y pathname', () => {
    expect(pathSegmentsFromReq({ query: { p: 'catalog-images/catalog/a.webp' } })).toEqual([
      'catalog-images',
      'catalog',
      'a.webp',
    ]);
    expect(pathSegmentsFromReq({ query: { path: ['catalog-images', 'catalog', 'a.webp'] } })).toEqual([
      'catalog-images',
      'catalog',
      'a.webp',
    ]);
    expect(pathSegmentsFromReq({ url: '/api/img/catalog-images/catalog/a.webp?x=1' })).toEqual([
      'catalog-images',
      'catalog',
      'a.webp',
    ]);
  });

  test('rechaza traversal y caracteres raros', () => {
    expect(isSafeObjectPath('catalog/a.webp')).toBe(true);
    expect(isSafeObjectPath('../x')).toBe(false);
    expect(isSafeObjectPath('catalog//a.webp')).toBe(false);
    expect(isSafeObjectPath('catalog/a.webp?x=1')).toBe(false);
  });
});
