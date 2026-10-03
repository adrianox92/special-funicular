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
const catalogSsrHandler = require('../../../frontend/api/catalog-ssr');

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
    const title = buildCatalogItemPageTitle(item, 'es');
    const desc = buildCatalogItemMetaDescription(item, 'es');
    expect(title).toContain('Scalextric');
    expect(title).toContain('C1234');
    expect(title).toContain('Slot Database');
    expect(desc).toContain('C1234');
    expect(desc).toContain('GT');
  });

  test('EN y DE no reutilizan la meta description en español', () => {
    const en = buildCatalogItemMetaDescription(item, 'en');
    const de = buildCatalogItemMetaDescription(item, 'de');
    expect(en).not.toMatch(/coche slot/i);
    expect(en).not.toMatch(/tracci[oó]n/i);
    expect(de).not.toMatch(/coche slot/i);
    expect(de).not.toMatch(/tracci[oó]n/i);
    expect(en.toLowerCase()).toContain('slot car');
    expect(de).toContain('Slotcar');
  });

  test('cuerpo EN usa chrome localizado y no “Anterior”', () => {
    const html = renderItemBody({
      item,
      locale: 'en',
      origin: 'https://www.slotdatabase.es',
      slug: catalogSlugify(item.model_name),
      neighbors: item.neighbors,
    });
    expect(html).toContain('Previous');
    expect(html).toContain('Next');
    expect(html).not.toContain('Anterior');
    expect(html).toContain('href="/en/catalog/');
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
    const supabaseItem = {
      ...item,
      image_url:
        'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp',
    };
    const cachedHtml = renderItemBody({
      item: supabaseItem,
      locale: 'es',
      origin: 'https://www.slotdatabase.es',
      slug,
      neighbors: item.neighbors,
    });
    expect(cachedHtml).toContain(
      'src="https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp"',
    );
    expect(cachedHtml).not.toContain('abcdxyz.supabase.co');
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
    const title = buildCatalogItemPageTitle(item, 'es');
    const description = buildCatalogItemMetaDescription(item, 'es');
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

describe('catalog-ssr bot gate', () => {
  function mockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, value) {
        this.headers[String(key).toLowerCase()] = value;
        return this;
      },
      send(body) {
        this.body = body;
        return this;
      },
    };
  }

  test('GPTBot recibe 403 y no el HTML del catálogo', async () => {
    const res = mockRes();
    await catalogSsrHandler(
      {
        method: 'GET',
        url: '/catalogo',
        headers: { 'user-agent': 'GPTBot' },
        query: {},
      },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(String(res.body)).toContain('Catálogo no disponible para clientes automatizados');
    expect(res.headers['x-robots-tag']).toMatch(/noindex/);
  });

  test('Chrome no es rechazado en la puerta (sigue al SSR)', async () => {
    const res = mockRes();
    await catalogSsrHandler(
      {
        method: 'GET',
        url: '/catalogo',
        headers: {
          host: '127.0.0.1:9',
          'x-forwarded-proto': 'http',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        query: {},
      },
      res,
    );
    expect(res.statusCode).not.toBe(403);
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
