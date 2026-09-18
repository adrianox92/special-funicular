const {
  parsePublicCatalogPath,
  catalogItemPath,
  hreflangForItem,
} = require('../../../frontend/api/_lib/parseCatalogPath');
const {
  buildCatalogItemPageTitle,
  buildCatalogItemMetaDescription,
  renderItemBody,
  injectIntoSpaHtml,
  buildHeadTags,
  catalogSlugify,
} = require('../../../frontend/api/_lib/catalogSeoHtml');
const { sitemapBackendPath } = require('../../../frontend/api/_lib/backendUrls');

describe('parsePublicCatalogPath', () => {
  test('ficha ES / EN / DE', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(parsePublicCatalogPath(`/catalogo/${id}/porsche-911`)).toEqual({
      locale: 'es',
      kind: 'item',
      id,
      slug: 'porsche-911',
      listPathEs: '/catalogo',
    });
    expect(parsePublicCatalogPath(`/en/catalog/${id}/porsche-911`).locale).toBe('en');
    expect(parsePublicCatalogPath(`/de/katalog/${id}/porsche-911`).locale).toBe('de');
  });

  test('listado con marca no se confunde con ficha', () => {
    const parsed = parsePublicCatalogPath('/catalogo/scalextric');
    expect(parsed.kind).toBe('list');
    expect(parsed.filters.manufacturerSlug).toBe('scalextric');
  });
});

describe('catalogSeoHtml', () => {
  const item = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    model_name: 'Porsche 911 GT3',
    manufacturer: 'Scalextric',
    reference: 'C1234',
    vehicle_type: 'GT',
    image_url: 'https://cdn.example/p911.jpg',
    neighbors: {
      prev: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        model_name: 'Ferrari 488',
        reference: 'C1000',
        manufacturer: 'Scalextric',
      },
      next: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        model_name: 'Audi R8',
        reference: 'C2000',
        manufacturer: 'Scalextric',
      },
    },
  };

  test('título y description únicos por ítem', () => {
    const title = buildCatalogItemPageTitle(item);
    const desc = buildCatalogItemMetaDescription(item);
    expect(title).toContain('Scalextric');
    expect(title).toContain('C1234');
    expect(title).toContain('Slot Database');
    expect(desc).toContain('C1234');
    expect(desc).toContain('GT');
  });

  test('cuerpo crawlable con img, datos y prev/next <a href>', () => {
    const slug = catalogSlugify(item.model_name);
    const html = renderItemBody({
      item,
      locale: 'es',
      origin: 'https://www.slotdatabase.es',
      slug,
      neighbors: item.neighbors,
    });
    expect(html).toContain('<h1>Porsche 911 GT3</h1>');
    expect(html).toContain('Scalextric');
    expect(html).toContain('C1234');
    expect(html).toContain('GT');
    expect(html).toContain('<img src="https://cdn.example/p911.jpg"');
    expect(html).toContain(`href="/catalogo/${item.neighbors.prev.id}/ferrari-488"`);
    expect(html).toContain(`href="/catalogo/${item.neighbors.next.id}/audi-r8"`);
    expect(html).toContain('Anterior');
    expect(html).toContain('Siguiente');
  });

  test('injectIntoSpaHtml sustituye title y rellena #root', () => {
    const spa =
      '<!DOCTYPE html><html lang="es"><head><title>Slot Database | genérico</title>' +
      '<meta name="description" content="genérico" />' +
      '</head><body><div id="root"></div></body></html>';
    const title = buildCatalogItemPageTitle(item);
    const description = buildCatalogItemMetaDescription(item);
    const canonical = `https://www.slotdatabase.es${catalogItemPath('es', item.id, 'porsche-911-gt3')}`;
    const headTags = buildHeadTags({
      locale: 'es',
      title,
      description,
      canonicalUrl: canonical,
      hreflangs: hreflangForItem('https://www.slotdatabase.es', item.id, 'porsche-911-gt3'),
      imageUrl: item.image_url,
      jsonLd: { '@type': 'Product', name: item.model_name, sku: item.reference },
    });
    const out = injectIntoSpaHtml(spa, {
      htmlLang: 'es',
      headTags,
      rootHtml: renderItemBody({
        item,
        locale: 'es',
        origin: 'https://www.slotdatabase.es',
        slug: 'porsche-911-gt3',
        neighbors: item.neighbors,
      }),
    });
    expect(out).toContain(`<title>${title}</title>`);
    expect(out).not.toContain('Slot Database | genérico');
    expect(out).toContain('application/ld+json');
    expect(out).toContain('"sku":"C1234"');
    expect(out).toContain('<div id="root">');
    expect(out).toContain('Porsche 911 GT3');
    expect(out).toContain('hreflang="de"');
    expect(out).toContain('/de/katalog/');
    expect(out).toContain(`rel="canonical" href="${canonical}"`);
    expect(out).toContain(`property="og:url" content="${canonical}"`);
    expect(canonical).toMatch(/^https:\/\/www\.slotdatabase\.es\//);
  });
});

describe('sitemapBackendPath', () => {
  test('solo índice y hijos conocidos', () => {
    expect(sitemapBackendPath(undefined)).toBe('/sitemap.xml');
    expect(sitemapBackendPath('static')).toBe('/sitemap-static.xml');
    expect(sitemapBackendPath('catalog-1')).toBe('/sitemap-catalog-1.xml');
    expect(sitemapBackendPath('catalog-0')).toBe(null);
    expect(sitemapBackendPath('../etc/passwd')).toBe(null);
  });
});
