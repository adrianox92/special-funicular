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
  const origin = 'https://slotdatabase.es';

  test('índice lista static + chunks de 5000', () => {
    expect(catalogChunkCount(0)).toBe(0);
    expect(catalogChunkCount(5000)).toBe(1);
    expect(catalogChunkCount(5001)).toBe(2);
    expect(catalogChunkCount(19410)).toBe(4);

    const xml = buildSitemapIndexXml({ origin, itemCount: 6468 });
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain(`${origin}/sitemap-static.xml`);
    expect(xml).toContain(`${origin}/sitemap-catalog-1.xml`);
    expect(xml).toContain(`${origin}/sitemap-catalog-2.xml`);
    expect(xml).not.toContain('sitemap-catalog-3');
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
    expect(xml).toContain('/catalogo/11111111-1111-4111-8111-111111111111/porsche-911</loc>');
    expect(xml).toContain('<lastmod>2024-06-01</lastmod>');
    expect(xml).toContain('/en/catalog/11111111-1111-4111-8111-111111111111/porsche-911');
    expect(xml).toContain('/de/katalog/11111111-1111-4111-8111-111111111111/porsche-911');
    expect((xml.match(/<url>/g) || []).length).toBe(1);
  });

  test('parseSitemapRequestPath', () => {
    expect(parseSitemapRequestPath('/sitemap.xml')).toEqual({ kind: 'index' });
    expect(parseSitemapRequestPath('/sitemap-static.xml')).toEqual({ kind: 'static' });
    expect(parseSitemapRequestPath('/sitemap-catalog-2.xml')).toEqual({ kind: 'catalog', chunk: 2 });
    expect(parseSitemapRequestPath('/sitemap-catalog-0.xml')).toEqual({ kind: 'unknown' });
    expect(parseSitemapRequestPath('/robots.txt')).toEqual({ kind: 'unknown' });
  });
});
