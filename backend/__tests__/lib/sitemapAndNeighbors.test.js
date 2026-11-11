const {
  compareCatalogOrder,
  neighborsFromList,
} = require('../../lib/catalogNeighbors');
const {
  buildSitemapIndexXml,
  buildStaticSitemapXml,
  buildCatalogChunkXml,
  catalogChunkCount,
  parseSitemapRequestPath,
  normalizePublicSiteOrigin,
  CATALOG_CHUNK_SIZE,
  CANONICAL_PUBLIC_ORIGIN,
} = require('../../lib/sitemapBuilder');

describe('compareCatalogOrder / neighborsFromList', () => {
  const items = [
    { id: 'b', manufacturer: 'Ninco', reference: 'A1', model_name: 'Ninco A' },
    { id: 'a', manufacturer: 'Avant', reference: 'Z9', model_name: 'Avant Z' },
    { id: 'c', manufacturer: 'Ninco', reference: 'A1', model_name: 'Ninco A dup' },
    { id: 'd', manufacturer: null, reference: 'ZZ', model_name: 'Sin marca' },
  ];

  test('marca ASC, referencia ASC, id ASC, nulls al final', () => {
    const sorted = [...items].sort(compareCatalogOrder).map((r) => r.id);
    expect(sorted).toEqual(['a', 'b', 'c', 'd']);
  });

  test('prev/next siguen ese orden', () => {
    expect(neighborsFromList(items, 'a')).toEqual({
      prev: null,
      next: expect.objectContaining({ id: 'b' }),
    });
    expect(neighborsFromList(items, 'b')).toEqual({
      prev: expect.objectContaining({ id: 'a' }),
      next: expect.objectContaining({ id: 'c' }),
    });
    expect(neighborsFromList(items, 'd')).toEqual({
      prev: expect.objectContaining({ id: 'c' }),
      next: null,
    });
  });
});

describe('sitemapBuilder', () => {
  const origin = CANONICAL_PUBLIC_ORIGIN;

  test('normaliza origen público a https://www.slotdatabase.es', () => {
    expect(normalizePublicSiteOrigin('https://slotdatabase.es')).toBe(origin);
    expect(normalizePublicSiteOrigin('https://slotdatabase.es/')).toBe(origin);
    expect(normalizePublicSiteOrigin('http://www.slotdatabase.es')).toBe(origin);
    expect(normalizePublicSiteOrigin('https://www.slotdatabase.es/')).toBe(origin);
    expect(normalizePublicSiteOrigin('slotdatabase.es')).toBe(origin);
    expect(normalizePublicSiteOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizePublicSiteOrigin('https://preview.example.vercel.app')).toBe(
      'https://preview.example.vercel.app',
    );
    expect(normalizePublicSiteOrigin('')).toBe('');
  });

  test('índice lista static + chunks de 2000', () => {
    expect(CATALOG_CHUNK_SIZE).toBe(2000);
    expect(catalogChunkCount(0)).toBe(0);
    expect(catalogChunkCount(2000)).toBe(1);
    expect(catalogChunkCount(2001)).toBe(2);
    expect(catalogChunkCount(19410)).toBe(10);

    const xml = buildSitemapIndexXml({ origin, itemCount: 6468 });
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain(`${origin}/sitemap-static.xml`);
    expect(xml).toContain(`${origin}/sitemap-catalog-1.xml`);
    expect(xml).toContain(`${origin}/sitemap-catalog-2.xml`);
    expect(xml).toContain(`${origin}/sitemap-catalog-4.xml`);
    expect(xml).not.toContain('sitemap-catalog-5');
    expect(xml).not.toContain('://slotdatabase.es/');
  });

  test('static incluye home, catálogo y marcas con hreflang', () => {
    const xml = buildStaticSitemapXml({
      origin,
      brands: [{ slug: 'scalextric' }, { slug: 'ninco' }],
    });
    expect(xml).toContain(`${origin}/catalogo</loc>`);
    expect(xml).toContain(`${origin}/catalogo/scalextric</loc>`);
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain(`${origin}/en/catalog/scalextric`);
    expect(xml).toContain(`${origin}/de/katalog/ninco`);
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toContain(`${origin}/en/catalog</loc>`);
  });

  test('chunk de catálogo: un loc ES por ítem + alternates', () => {
    const xml = buildCatalogChunkXml({
      origin,
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          model_name: 'Porsche 911',
          reference: 'A100',
          updated_at: '2024-06-01T12:00:00.000Z',
        },
      ],
    });
    expect(xml).toContain(
      `<loc>${origin}/catalogo/11111111-1111-4111-8111-111111111111/porsche-911</loc>`,
    );
    expect(xml).toContain('<lastmod>2024-06-01</lastmod>');
    expect(xml).toContain(
      `hreflang="en" href="${origin}/en/catalog/11111111-1111-4111-8111-111111111111/porsche-911"`,
    );
    expect(xml).toContain(
      `hreflang="de" href="${origin}/de/katalog/11111111-1111-4111-8111-111111111111/porsche-911"`,
    );
    expect(xml).toContain(
      `hreflang="x-default" href="${origin}/catalogo/11111111-1111-4111-8111-111111111111/porsche-911"`,
    );
    expect((xml.match(/<url>/g) || []).length).toBe(1);
    expect(xml).not.toContain('<image:image>');
  });

  test('chunk de catálogo anuncia la foto solo si hay image_url', () => {
    const withPhoto = buildCatalogChunkXml({
      origin,
      rows: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          manufacturer: 'N.S.R.',
          model_name: 'Hypercar',
          reference: 'NSR0648SW',
          image_url:
            'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp',
          updated_at: '2024-06-01T12:00:00.000Z',
        },
      ],
    });
    expect(withPhoto).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(withPhoto).toContain(
      `<image:loc>${origin}/api/img/catalog-images/catalog/1710000000-ab12cd.webp</image:loc>`,
    );
    expect(withPhoto).toContain('<image:title>N.S.R. · NSR0648SW · Hypercar</image:title>');
    expect(withPhoto).not.toContain('abcdxyz.supabase.co');
    expect((withPhoto.match(/<image:image>/g) || []).length).toBe(1);

    const withoutPhoto = buildCatalogChunkXml({
      origin,
      rows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          manufacturer: 'Scalextric',
          model_name: 'Porsche 911',
          reference: 'A100',
          image_url: null,
          updated_at: '2024-06-01T12:00:00.000Z',
        },
      ],
    });
    expect(withoutPhoto).not.toContain('<image:image>');
    expect(withoutPhoto).not.toContain('logo512');
  });

  test('parseSitemapRequestPath', () => {
    expect(parseSitemapRequestPath('/sitemap.xml')).toEqual({ kind: 'index' });
    expect(parseSitemapRequestPath('/sitemap-static.xml')).toEqual({ kind: 'static' });
    expect(parseSitemapRequestPath('/sitemap-catalog-2.xml')).toEqual({ kind: 'catalog', chunk: 2 });
    expect(parseSitemapRequestPath('/sitemap-catalog-0.xml')).toEqual({ kind: 'unknown' });
    expect(parseSitemapRequestPath('/robots.txt')).toEqual({ kind: 'unknown' });
  });
});
