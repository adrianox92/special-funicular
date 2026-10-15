'use strict';

const fs = require('fs');
const path = require('path');
const {
  publicImageOrigin,
  rewritePublicCatalogResponse,
  DEFAULT_PUBLIC_IMAGE_ORIGIN,
} = require('../../lib/publicCatalogImageUrls');

const CATALOG =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';
const LOGO =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/brands/scx.webp';

describe('publicImageOrigin', () => {
  test('PUBLIC_IMAGE_ORIGIN gana; apex pasa a www', () => {
    expect(publicImageOrigin({ PUBLIC_IMAGE_ORIGIN: 'https://slotdatabase.es/' })).toBe(
      DEFAULT_PUBLIC_IMAGE_ORIGIN,
    );
    expect(
      publicImageOrigin({
        PUBLIC_IMAGE_ORIGIN: 'https://preview.example',
        PUBLIC_SITE_ORIGIN: 'https://www.slotdatabase.es',
      }),
    ).toBe('https://preview.example');
    expect(publicImageOrigin({ PUBLIC_SITE_ORIGIN: 'https://www.slotdatabase.es' })).toBe(
      DEFAULT_PUBLIC_IMAGE_ORIGIN,
    );
    expect(publicImageOrigin({})).toBe(DEFAULT_PUBLIC_IMAGE_ORIGIN);
  });
});

describe('rewritePublicCatalogResponse', () => {
  test('listado e ítem no exponen hosts de Storage', () => {
    const env = { PUBLIC_IMAGE_ORIGIN: 'https://www.slotdatabase.es' };
    const list = rewritePublicCatalogResponse(
      {
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            image_url: CATALOG,
            manufacturer_logo_url: LOGO,
            model_name: '911',
          },
        ],
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
      },
      env,
    );
    expect(list.items[0].image_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
    );
    expect(list.items[0].manufacturer_logo_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/brands/scx.webp',
    );
    expect(list.items[0].model_name).toBe('911');
    expect(JSON.stringify(list)).not.toMatch(/supabase\.co/i);

    const brands = rewritePublicCatalogResponse({ brands: [{ name: 'SCX', logo_url: LOGO }] }, env);
    expect(brands.brands[0].logo_url).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/brands/scx.webp',
    );

    const detail = rewritePublicCatalogResponse(
      { id: '1', image_url: CATALOG, neighbors: { prev: null, next: null } },
      env,
    );
    expect(detail.image_url).toContain('/api/img/catalog-images/');
    expect(detail.neighbors).toEqual({ prev: null, next: null });
  });

  test('no reescribe URLs que no son Storage (sync-compat de campos ajenos)', () => {
    const env = { PUBLIC_IMAGE_ORIGIN: 'https://www.slotdatabase.es' };
    const out = rewritePublicCatalogResponse(
      { image_url: 'https://cdn.example/p911.jpg', real_race_photos_url: 'https://flickr.com/x' },
      env,
    );
    expect(out.image_url).toBe('https://cdn.example/p911.jpg');
    expect(out.real_race_photos_url).toBe('https://flickr.com/x');
  });
});

describe('partner sync compatibility', () => {
  test('las rutas /api/sync/* no reescriben URLs de Storage', () => {
    const syncDir = path.join(__dirname, '../../routes');
    for (const file of ['sync.js', 'syncCompetitions.js']) {
      const src = fs.readFileSync(path.join(syncDir, file), 'utf8');
      expect(src).not.toContain('rewritePublicCatalogResponse');
      expect(src).not.toContain('publicCatalogImageUrls');
      expect(src).not.toContain('rewritePublicCatalogMediaUrls');
    }
  });
});
