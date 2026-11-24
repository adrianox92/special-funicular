const {
  cachedStorageImageUrl,
  parseAllowedStorageUrl,
  resolveStorageImageRequest,
  pathSegmentsFromReq,
  allowedStorageHostsFromEnv,
  isSafeObjectPath,
  rewritePublicCatalogMediaUrls,
  parseR2ProxyUrl,
} = require('../../utils/cachedStorageImageUrl');
const { catalogThumbUrl } = require('../../utils/catalogImageVariants');

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

  test('con origin, una ruta /api/img relativa se absolutiza; /logo no', () => {
    expect(
      cachedStorageImageUrl('/api/img/catalog-images/catalog/a.webp', {
        origin: 'https://www.slotdatabase.es',
      }),
    ).toBe('https://www.slotdatabase.es/api/img/catalog-images/catalog/a.webp');
    expect(cachedStorageImageUrl('/logo512.png', { origin: 'https://www.slotdatabase.es' })).toBe(
      '/logo512.png',
    );
  });
});

describe('rewritePublicCatalogMediaUrls', () => {
  const origin = 'https://www.slotdatabase.es';
  const proxied = `${origin}/api/img/catalog-images/catalog/1710000000-ab12cd.webp`;
  const logo =
    'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/brands/logo.webp';

  test('reescribe image_url, manufacturer_logo_url y logo_url con origin', () => {
    const out = rewritePublicCatalogMediaUrls(
      {
        items: [
          {
            id: '1',
            image_url: CATALOG,
            manufacturer_logo_url: logo,
            reference: 'C1',
          },
        ],
        brands: [{ id: 'b1', name: 'Scalextric', logo_url: logo }],
        total: 1,
      },
      { origin },
    );
    expect(out.items[0].image_url).toBe(proxied);
    expect(out.items[0].manufacturer_logo_url).toBe(
      `${origin}/api/img/catalog-images/brands/logo.webp`,
    );
    expect(out.items[0].reference).toBe('C1');
    expect(out.brands[0].logo_url).toBe(`${origin}/api/img/catalog-images/brands/logo.webp`);
    expect(out.total).toBe(1);
    expect(JSON.stringify(out)).not.toContain('supabase.co');
  });

  test('es idempotente sobre URLs ya proxificadas y conserva -thumb', () => {
    const once = rewritePublicCatalogMediaUrls({ image_url: CATALOG }, { origin });
    const twice = rewritePublicCatalogMediaUrls(once, { origin });
    expect(twice.image_url).toBe(proxied);
    expect(catalogThumbUrl(twice.image_url)).toBe(
      `${origin}/api/img/catalog-images/catalog/1710000000-ab12cd-thumb.webp`,
    );
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

describe('Cloudflare R2 (bucket privado tras /api/img/r2/)', () => {
  const R2_CATALOG = 'https://www.slotdatabase.es/api/img/r2/catalog-images/catalog/1790000000-ab12cd.webp';
  const R2_VEHICLE = 'https://www.slotdatabase.es/api/img/r2/vehicle-images/vehicles/u1/1790000000-front.webp';
  const env = { REACT_APP_SUPABASE_URL: 'https://abcdxyz.supabase.co' };

  test('parseR2ProxyUrl acepta cualquier origen y valida bucket y ruta', () => {
    expect(parseR2ProxyUrl(R2_CATALOG)).toEqual({
      bucket: 'catalog-images',
      objectPath: 'catalog/1790000000-ab12cd.webp',
    });
    expect(parseR2ProxyUrl('/api/img/r2/vehicle-images/vehicles/u1/a.webp')).toMatchObject({
      bucket: 'vehicle-images',
    });
    expect(parseR2ProxyUrl('https://www.slotdatabase.es/api/img/r2/secret/x.webp')).toBeNull();
    expect(parseR2ProxyUrl('https://www.slotdatabase.es/api/img/r2/catalog-images/../x.webp')).toBeNull();
    expect(parseR2ProxyUrl(CATALOG)).toBeNull();
  });

  test('reescribe al proxy relativo y la miniatura conserva el prefijo', () => {
    const proxied = cachedStorageImageUrl(R2_CATALOG);
    expect(proxied).toBe('/api/img/r2/catalog-images/catalog/1790000000-ab12cd.webp');
    expect(catalogThumbUrl(proxied)).toBe('/api/img/r2/catalog-images/catalog/1790000000-ab12cd-thumb.webp');
    expect(
      cachedStorageImageUrl('https://preview.example/api/img/r2/vehicle-images/vehicles/u1/1790000000-front.webp', {
        origin: 'https://www.slotdatabase.es',
      }),
    ).toBe(R2_VEHICLE);
  });

  test('con el proxy desactivado (dev local) deja la URL absoluta', () => {
    expect(cachedStorageImageUrl(R2_CATALOG, { enabled: false })).toBe(R2_CATALOG);
  });

  test('rewritePublicCatalogMediaUrls mezcla Supabase y R2', () => {
    const out = rewritePublicCatalogMediaUrls(
      { items: [{ image_url: R2_CATALOG }, { image_url: CATALOG }] },
      { origin: 'https://www.slotdatabase.es' },
    );
    expect(out.items[0].image_url).toBe(
      'https://www.slotdatabase.es/api/img/r2/catalog-images/catalog/1790000000-ab12cd.webp',
    );
    expect(out.items[1].image_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
    );
  });

  test('resolveStorageImageRequest marca el segmento r2 sin URL de origen', () => {
    expect(
      resolveStorageImageRequest({
        pathSegments: ['r2', 'catalog-images', 'catalog', '1790000000-ab12cd.webp'],
        env: {},
      }),
    ).toEqual({
      ok: true,
      provider: 'r2',
      bucket: 'catalog-images',
      objectPath: 'catalog/1790000000-ab12cd.webp',
    });
  });

  test('segmento r2: 400 con bucket o path no permitidos', () => {
    expect(
      resolveStorageImageRequest({ pathSegments: ['r2', 'secret', 'x.webp'], env }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      resolveStorageImageRequest({ pathSegments: ['r2', 'catalog-images'], env }),
    ).toMatchObject({ ok: false, status: 400 });
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
