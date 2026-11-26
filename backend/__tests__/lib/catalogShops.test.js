const {
  createShopAdapter,
  wooStoreLookup,
  listWooCatalog,
  parseJoaquiProduct,
  joaquiCandidates,
  parseCricProduct,
  criccracLookup,
  htycProductHit,
  listHtycProducts,
  parseSlotmaniaProduct,
  slotmaniaCandidates,
  listSlotmaniaCatalog,
  slotmaniaCarCategories,
  shopifyCatalogHits,
  listShopifyCollection,
  shopifyLookup,
  parseShopifyProduct,
  cocheslotListingHits,
  listCocheslotCatalog,
  cocheslotCandidates,
  parseCocheslotProduct,
  parseAloyProduct,
  aloyCandidates,
} = require('../../lib/shopAdapters/catalogShops');
const {
  sameSku,
  searchQueries,
  parseEvotecProduct,
  parseDataProduct,
  parseJsonLdProduct,
  parseWooProduct,
  productListCards,
  cardProductUrl,
  textHasCode,
  itemListUrls,
  urlsContainingCode,
  isSpareProduct,
} = require('../../lib/shopAdapters/productParse');

const EVOTEC_SEARCH = `
<ul class="product_list">
  <li class="ajax_block_product">
    <div>Sideways (Ref.:RCSW0082)</div>
    <a href="https://evotecshop.com/en/turismos/19123-ford-escort.html">Escort</a>
  </li>
</ul>
<a href="https://evotecshop.com/en/reserva/4626-ford-gt40.html">destacado</a>
`;

const EVOTEC_PRODUCT = `
<span id="our_price_display">67,95€</span>
<p id="availability_statut" style="display: none;"></p>
<p class="buttons_bottom_block" id="add_to_cart"></p>
<script>var productReference='RCSW0082';var productAvailableForOrder='1';</script>
`;

const MINISTRY_SEARCH = `
<script type="application/ld+json">
{ "@type": "ItemList", "itemListElement": [
  { "@type": "ListItem", "url": "https://www.ministryofhobby.com/es/gt-modernos/13406-mercedes.html" }
] }
</script>
<a href="https://www.ministryofhobby.com/es/ofertas/12188-otro.html">otro</a>
`;

const MINISTRY_PRODUCT = `
<div data-product="{&quot;reference&quot;:&quot;NSR0650AW&quot;,&quot;price_amount&quot;:75.38,&quot;quantity&quot;:1,&quot;available_for_order&quot;:0}"></div>
`;

const UNION_SEARCH = `
<a href="https://www.slotcar-union.com/en/cars/25673-scalextric-c4555-subaru.html">C4555</a>
`;

const UNION_IN_STOCK = `
<script type="application/ld+json">
{ "@type": "Product", "sku": "C4555", "gtin13": "5063129022341",
  "offers": { "price": "59.90", "priceCurrency": "EUR", "availability": "https://schema.org/InStock",
    "url": "https://www.slotcar-union.com/en/cars/25673-scalextric-c4555-subaru.html" } }
</script>
`;

const UNION_GONE = `
<script type="application/ld+json">
{ "@type": "Product", "sku": "C4545",
  "offers": { "price": "52.90", "priceCurrency": "EUR", "availability": "https://schema.org/Discontinued",
    "url": "https://www.slotcar-union.com/en/cars/26284-mini.html" } }
</script>
`;

function pages(map) {
  return async (url) => {
    if (!Object.prototype.hasOwnProperty.call(map, url)) {
      throw new Error(`sin fixture ${url}`);
    }
    return map[url];
  };
}

describe('referencias de tienda', () => {
  test('RCSW82 y RCSW0082 son la misma referencia', () => {
    expect(sameSku('RCSW82', 'RCSW0082')).toBe(true);
    expect(sameSku('C4555', 'C4545')).toBe(false);
    expect(searchQueries('RCSW82', null)).toEqual(['RCSW82', 'RCSW0082']);
  });

  test('un chasis o un neumático con la misma referencia no es el coche', () => {
    expect(isSpareProduct({
      productUrl: 'https://evotecshop.com/en/chasis/9265-chasis-p-bancada-externa-ferrari-512-m-spirit.html',
      name: 'Chasis P Bancada externa Ferrari 512 M - Spirit',
    })).toBe(true);
    expect(isSpareProduct({
      productUrl: 'https://slotmania.es/es/coches/11547-neumaticos-as20-195x105-mm.html',
      name: 'Neumáticos AS20',
    })).toBe(true);
    expect(isSpareProduct({
      productUrl: 'https://trofeslot.com/producto/chasis-3dp-lmb/',
      name: 'Chasis 3DP LMB',
      categorySlugs: ['chasis', 'scaleauto'],
    })).toBe(true);
    expect(isSpareProduct({
      productUrl: 'https://evotecshop.com/en/clasicos/21070-porsche-917k-azul-chasis-evo3-sidewinder.html',
      name: 'Porsche 917K Azul - Chasis EVO3',
    })).toBe(false);
    expect(isSpareProduct({
      productUrl: 'https://trofeslot.com/producto/lancia-037-martini-chasis-evo3-in-line/',
      name: 'Lancia 037 Martini – Chasis EVO3 In-Line',
      categorySlugs: ['rally', 'fly-car-model'],
    })).toBe(false);
    expect(isSpareProduct({
      productUrl: 'https://www.htyc-slotshop.es/buscador/FORD-TRANSIT-TROPHY-26-p784457504',
      name: 'Ford Transit Trophy',
    })).toBe(false);
    expect(isSpareProduct({
      productUrl: 'https://evotecshop.com/en/trofeos/12-copa.html',
      name: 'Trofeo copa',
    })).toBe(true);
  });
});

describe('adaptadores de tienda', () => {
  test('Evotec enlaza RCSW82 con la ficha RCSW0082 y su precio', async () => {
    const adapter = createShopAdapter({
      key: 'evotec',
      origin: 'https://evotecshop.com',
      searchUrl: (query) => `https://evotec.test/search?q=${encodeURIComponent(query)}`,
      parse: parseEvotecProduct,
      candidates(html, query) {
        const urls = [];
        for (const card of productListCards(html)) {
          if (!textHasCode(card, query)) continue;
          const url = cardProductUrl(card, 'https://evotecshop.com');
          if (url) urls.push(url);
        }
        return [...new Set(urls)];
      },
    }, {
      fetchPage: pages({
        'https://evotec.test/search?q=RCSW82': EVOTEC_SEARCH,
        'https://evotecshop.com/en/turismos/19123-ford-escort.html': EVOTEC_PRODUCT,
      }),
    });

    await expect(adapter.findByReference({ reference: 'RCSW82', ean: null })).resolves.toEqual({
      productUrl: 'https://evotecshop.com/en/turismos/19123-ford-escort.html',
      price: 67.95,
      currency: 'EUR',
      inStock: true,
    });
  });

  test('Evotec no enlaza el chasis cuando la referencia coincide con el coche', async () => {
    const chassisUrl = 'https://evotecshop.com/en/chasis/9265-chasis-p-bancada-ferrari-512.html';
    const carUrl = 'https://evotecshop.com/en/turismos/19492-ferrari-333-sp.html';
    const search = `
      <ul class="product_list">
        <li class="ajax_block_product">
          <div>Spirit (Ref.:RS0060)</div>
          <a href="${chassisUrl}">Chasis</a>
        </li>
        <li class="ajax_block_product">
          <div>Revoslot (Ref.:RS0060)</div>
          <a href="${carUrl}">Ferrari</a>
        </li>
      </ul>
    `;
    const sheet = (sku) => `
      <span id="our_price_display">${sku === 'RS-0060' ? '7,50€' : '157,90€'}</span>
      <p id="availability_statut" style="display: none;"></p>
      <p class="buttons_bottom_block" id="add_to_cart"></p>
      <script>var productReference='${sku}';var productAvailableForOrder='1';</script>
    `;
    const adapter = createShopAdapter({
      key: 'evotec',
      origin: 'https://evotecshop.com',
      searchUrl: (query) => `https://evotec.test/search?q=${encodeURIComponent(query)}`,
      parse: parseEvotecProduct,
      candidates(html, query) {
        const urls = [];
        for (const card of productListCards(html)) {
          if (!textHasCode(card, query)) continue;
          const url = cardProductUrl(card, 'https://evotecshop.com');
          if (url) urls.push(url);
        }
        return [...new Set(urls)];
      },
    }, {
      fetchPage: pages({
        'https://evotec.test/search?q=RS0060': search,
        [chassisUrl]: `<h1>Chasis P Bancada externa Ferrari 512 M - Spirit</h1>${sheet('RS-0060')}`,
        [carUrl]: `<h1>Ferrari 333 SP Twin Pack</h1>${sheet('RS0060')}`,
      }),
    });

    await expect(adapter.findByReference({ reference: 'RS0060', ean: null })).resolves.toEqual({
      productUrl: carUrl,
      price: 157.9,
      currency: 'EUR',
      inStock: true,
    });
    await expect(adapter.checkProduct(chassisUrl)).resolves.toBeNull();
  });

  test('Ministry usa el ItemList y no marca stock si la ficha no admite pedido', async () => {
    const productUrl = 'https://www.ministryofhobby.com/es/gt-modernos/13406-mercedes.html';
    const adapter = createShopAdapter({
      key: 'ministry-of-hobby',
      origin: 'https://www.ministryofhobby.com',
      searchUrl: (query) => `https://moh.test/search?q=${encodeURIComponent(query)}`,
      parse: parseDataProduct,
      candidates: (html) => itemListUrls(html, 'https://www.ministryofhobby.com'),
    }, {
      fetchPage: pages({
        'https://moh.test/search?q=NSR0650AW': MINISTRY_SEARCH,
        [productUrl]: MINISTRY_PRODUCT,
      }),
    });

    await expect(adapter.findByReference({ reference: 'NSR0650AW', ean: null })).resolves.toEqual({
      productUrl,
      price: 75.38,
      currency: 'EUR',
      inStock: false,
    });
  });

  test('Slot Car Union lee el JSON-LD y distingue stock de descatalogado', async () => {
    const adapter = createShopAdapter({
      key: 'slot-car-union',
      origin: 'https://www.slotcar-union.com',
      searchUrl: (query) => `https://union.test/search?q=${encodeURIComponent(query)}`,
      parse: parseJsonLdProduct,
      candidates: (html, query) => {
        const listed = itemListUrls(html, 'https://www.slotcar-union.com');
        if (listed.length > 0) return listed;
        return urlsContainingCode(html, 'https://www.slotcar-union.com', query);
      },
    }, {
      fetchPage: pages({
        'https://union.test/search?q=C4555': UNION_SEARCH,
        'https://www.slotcar-union.com/en/cars/25673-scalextric-c4555-subaru.html': UNION_IN_STOCK,
        'https://www.slotcar-union.com/en/cars/26284-mini.html': UNION_GONE,
      }),
    });

    await expect(adapter.findByReference({ reference: 'C4555', ean: null })).resolves.toMatchObject({
      price: 59.9,
      inStock: true,
    });
    await expect(adapter.checkProduct('https://www.slotcar-union.com/en/cars/26284-mini.html')).resolves.toMatchObject({
      price: 52.9,
      inStock: false,
    });
  });

  test('WooCommerce usa el precio de venta y las unidades disponibles', async () => {
    const productUrl = 'https://trofeslot.com/producto/296-gt3/';
    const html = `
      <script type="application/ld+json">
      {"@type":"Product","sku":"AV52310","offers":{
        "priceSpecification":[
          {"price":"71.96","priceCurrency":"EUR"},
          {"price":"79.95","priceCurrency":"EUR","priceType":"https://schema.org/ListPrice"}
        ],
        "availability":"https://schema.org/InStock",
        "url":"${productUrl}"
      }}
      </script>
      <p class="stock in-stock"><label>Status:</label>18 disponibles</p>
    `;
    const fetchPage = async (url) => {
      if (String(url).includes('/wp-json/')) {
        return JSON.stringify([{
          sku: 'AV52310',
          permalink: productUrl,
          is_in_stock: true,
          prices: { price: '7196', currency_code: 'EUR', currency_minor_unit: 2 },
        }]);
      }
      if (String(url).includes('agotado')) {
        return html.replace('18 disponibles', '0 disponibles');
      }
      return html;
    };
    const adapter = createShopAdapter({
      key: 'trofeslot',
      origin: 'https://trofeslot.com',
      lookupOnly: true,
      lookup: (page, query) => wooStoreLookup('https://trofeslot.com', page, query),
      searchUrl: (query) => `https://trofeslot.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`,
      parse: parseWooProduct,
      candidates: () => [],
    }, { fetchPage });

    await expect(adapter.findByReference({ reference: 'AV52310', ean: null })).resolves.toEqual({
      productUrl,
      price: 71.96,
      currency: 'EUR',
      inStock: true,
    });
    await expect(adapter.checkProduct(productUrl)).resolves.toMatchObject({ price: 71.96, inStock: true });
    await expect(adapter.checkProduct('https://trofeslot.com/producto/agotado/')).resolves.toMatchObject({
      inStock: false,
    });
  });

  test('listWooCatalog recorre todas las páginas y recupera el agotado oculto', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      sku: `SKU${index}`,
      permalink: `https://trofeslot.com/producto/${index}/`,
      is_in_stock: true,
      prices: { price: '1000', regular_price: '1000', currency_code: 'EUR', currency_minor_unit: 2 },
    }));
    const lastPage = [{
      sku: 'Referencia: AV52310',
      permalink: 'https://trofeslot.com/producto/296/',
      is_in_stock: false,
      prices: { price: '6750', regular_price: '7500', currency_code: 'EUR', currency_minor_unit: 2 },
    }];
    const hidden = {
      sku: 'SC6237R',
      permalink: 'https://www.speedslot.es/producto/peugeot-208-rally-artic-2013/',
      is_in_stock: false,
      prices: { price: '7994', regular_price: '7994', currency_code: 'EUR', currency_minor_unit: 2 },
    };
    const fetchPage = jest.fn(async (url) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.get('on_sale')).toBeNull();
      expect(parsed.searchParams.get('category')).toBe('22');
      const stock = parsed.searchParams.get('stock_status');
      const page = Number(parsed.searchParams.get('page'));
      if (stock === 'outofstock') return JSON.stringify(page === 1 ? [hidden, lastPage[0]] : []);
      if (stock === 'onbackorder') return JSON.stringify([]);
      expect(stock).toBeNull();
      return JSON.stringify(page === 1 ? fullPage : lastPage);
    });

    const products = await listWooCatalog('https://model-hobbyred.com', fetchPage, { category: 22 });

    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(products).toHaveLength(102);
    expect(products[100]).toMatchObject({
      sku: 'Referencia: AV52310',
      price: 67.5,
      regularPrice: 75,
      inStock: false,
    });
    expect(products[101]).toMatchObject({
      sku: 'SC6237R',
      price: 79.94,
      inStock: false,
    });
  });
});

describe('joaquimoslot', () => {
  const search = `
    <div class="product-card"><a href="https://www.joaquimoslot.com/rally/otro-coche">otro</a></div>
    <div class="product-card"><a href="https://www.joaquimoslot.com/rally/superslot-h4555-subaru">H4555</a></div>
  `;
  const product = `
    <span class="text-precio">27,00€</span>
    <span class="key">Ref</span><span class="value">H4555</span>
    88 Unidades en stock
    <form class="add2cart"></form>
  `;

  test('elige la ficha que contiene la referencia y lee precio y stock', () => {
    expect(joaquiCandidates(search, 'H4555')).toEqual([
      'https://www.joaquimoslot.com/rally/superslot-h4555-subaru',
    ]);
    expect(parseJoaquiProduct(product, 'https://www.joaquimoslot.com/rally/superslot-h4555-subaru')).toMatchObject({
      price: 27,
      sku: 'H4555',
      inStock: true,
    });
  });
});

describe('criccrac', () => {
  test('el precio publicado es el de la ficha con IVA y el stock sale de is_salable', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        results: {
          1: {
            product_code: 'SC-6224RS',
            is_salable: '1',
            custom_slots: {
              thumbnail_link: '<a href="/tienda/product/21082-sc-6224rs">foto</a>',
              item_add_to_cart_and_price: '<span class="price_with_vat">89,52€</span>',
            },
          },
        },
      }),
    }));

    await expect(criccracLookup('SC-6224RS', fetchImpl)).resolves.toMatchObject({
      productUrl: 'https://www.criccrac.com/tienda/product/21082-sc-6224rs',
      price: 89.52,
      sku: 'SC-6224RS',
      inStock: true,
    });
    expect(parseCricProduct(
      '<span itemprop="price" content="89.52">89,52 €</span><meta itemprop="availability" content="http://schema.org/InStock" />',
      'https://www.criccrac.com/tienda/product/21082-sc-6224rs',
    )).toMatchObject({ price: 89.52, inStock: true });
  });

  test('SC6350R se busca también como SC-6350R y no se queda con la variante RS', async () => {
    const fetchImpl = jest.fn(async (_url, init) => {
      const ref = new URLSearchParams(init.body).get('form_data[referencia]');
      if (ref !== 'SC-6350R') return { ok: true, json: async () => ({ results: {} }) };
      return {
        ok: true,
        json: async () => ({
          results: {
            1: {
              product_code: 'SC-6350RS',
              is_salable: '1',
              name: 'Callaway RS',
              custom_slots: {
                thumbnail_link: '<a href="/tienda/product/19199-sc-6350rs">foto</a>',
                item_add_to_cart_and_price: '<span class="price_with_vat">89,95€</span>',
              },
            },
            2: {
              product_code: 'SC-6350R',
              is_salable: '1',
              name: 'Callaway R',
              custom_slots: {
                thumbnail_link: '<a href="/tienda/product/16263-sc-6350r">foto</a>',
                item_add_to_cart_and_price: '<span class="price_with_vat">49,95€</span>',
              },
            },
          },
        }),
      };
    });

    await expect(criccracLookup('SC6350R', fetchImpl)).resolves.toMatchObject({
      productUrl: 'https://www.criccrac.com/tienda/product/16263-sc-6350r',
      sku: 'SC-6350R',
      price: 49.95,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('htyc-slotshop', () => {
  const row = (sku, id) => ({
    identifier: { productId: id },
    slugs: { forRouteWithId: `coche-${sku}` },
    seo: {
      jsonLD: JSON.stringify({
        '@type': 'Product',
        sku,
        offers: { price: '54.99', priceCurrency: 'EUR', availability: 'http://schema.org/InStock' },
      }),
    },
  });

  test('lee el sku del JSON-LD y pagina el catálogo', async () => {
    expect(htycProductHit(row('A2130', 874))).toMatchObject({
      sku: 'A2130',
      price: 54.99,
      inStock: true,
      productUrl: 'https://www.htyc-slotshop.es/buscador/coche-A2130-p874',
    });
    const fetchImpl = jest.fn(async (_url, init) => {
      const { offset } = JSON.parse(init.body).pagination;
      const products = offset === 0
        ? Array.from({ length: 100 }, (_, index) => row(`S${index}`, index))
        : [row('A2130', 874)];
      return { ok: true, json: async () => ({ products }) };
    });

    const products = await listHtycProducts(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(products).toHaveLength(101);
    expect(products[100].sku).toBe('A2130');
  });
});

describe('slotmania', () => {
  const search = `
    <article class="product-miniature">
      <a href="https://slotmania.es/es/coches/1-otro.html">Otro</a>
    </article>
    <article class="product-miniature">
      <a href="https://slotmania.es/es/coches/11632-ford-rs200.html">SC6455</a>
    </article>
  `;
  const product = `
    <script type="application/ld+json">
      { "@type": "Product", "sku": "SC6455",
        "offers": { "price": "60.8", "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "url": "https://slotmania.es/es/coches/11632-ford-rs200.html" } }
    </script>
    <span class="regular-price text-muted">74,95 €</span>
    <span class="js-product-availability badge product-available">Disponible</span>
  `;

  test('elige la ficha de la referencia y guarda el precio tachado', () => {
    expect(slotmaniaCandidates(search, 'SC6455')).toEqual([
      'https://slotmania.es/es/coches/11632-ford-rs200.html',
    ]);
    expect(parseSlotmaniaProduct(product, 'https://slotmania.es/es/coches/11632-ford-rs200.html')).toMatchObject({
      sku: 'SC6455',
      price: 60.8,
      regularPrice: 74.95,
      inStock: true,
    });
  });

  test('una ficha agotada no queda en stock', () => {
    const html = product.replace('product-available', 'product-unavailable').replace('InStock', 'OutOfStock');
    expect(parseSlotmaniaProduct(html, 'https://slotmania.es/es/coches/11632-ford-rs200.html').inStock).toBe(false);
  });

  test('el listado de coches trae referencia, precio y stock sin abrir la ficha', async () => {
    const card = (sku, stockClass) => `
      <article class="product-miniature">
        <a href="https://slotmania.es/es/coches/10263-${sku.toLowerCase()}.html">coche</a>
        <span class="badge ${stockClass}">estado</span>
        <h2 class="h3 product-title"><a href="https://slotmania.es/es/coches/10263-${sku.toLowerCase()}.html">Peugeot</a></h2>
        <div class="product-reference text-muted">${sku}</div>
        <span class="product-price" content="79.95">79,95 €</span>
      </article>`;
    const fetchPage = jest.fn(async (url) => {
      if (url.endsWith('?page=2')) {
        return `${card('SC6300R', 'product-unavailable')}`;
      }
      return `${card('SC6237R', 'product-available')}<a href="https://slotmania.es/es/168-coches?page=2">2</a>`;
    });

    const products = await listSlotmaniaCatalog(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(products).toEqual([
      expect.objectContaining({ sku: 'SC6237R', price: 79.95, inStock: true }),
      expect.objectContaining({ sku: 'SC6300R', price: 79.95, inStock: false }),
    ]);
  });

  test('el menú de coches no sigue hacia recambios', () => {
    const html = `
      <a href="https://slotmania.es/es/168-coches">COCHES</a>
      <a href="https://slotmania.es/es/713-brm">BRM</a>
      <a href="https://slotmania.es/es/642-coches-gt">Coches GT</a>
      <a href="https://slotmania.es/es/103-chasis">CHASIS</a>
      <a href="https://slotmania.es/es/648-scalextric">Scalextric</a>
    `;
    expect(slotmaniaCarCategories(html)).toEqual([
      'https://slotmania.es/es/168-coches',
      'https://slotmania.es/es/713-brm',
      'https://slotmania.es/es/642-coches-gt',
    ]);
  });
});

describe('aloyshop', () => {
  const search = `
    <ul class="product_list grid row">
      <li class="ajax_block_product">
        <a href="https://www.aloyshop.com/es/descatalogados/9671-corvette.html?search_query=NSR0006">viejo</a>
        <p itemprop="reference">DESCATALOGADO NSR0006 AW</p>
      </li>
      <li class="ajax_block_product">
        <a href="https://www.aloyshop.com/es/precio-neto/8942-corvette.html?search_query=NSR0006&results=2">coche</a>
        <p itemprop="reference">NSR0006</p>
      </li>
      <li class="ajax_block_product">
        <a href="https://www.aloyshop.com/es/precio-neto/1-otro.html?search_query=NSR0006">otro</a>
        <p itemprop="reference">OTRO1</p>
      </li>
    </ul>
  `;
  const product = `
    <span class="editable" itemprop="sku">NSR0006</span>
    <link itemprop="availability" href="http://schema.org/InStock">
    <span id="availability_value">En Stock. Envío inmediato.</span>
    <span id="our_price_display" itemprop="price">62,05 €</span>
    <span id="old_price_display">68,95 €</span>
  `;

  test('ignora descatalogados y el precio de búsqueda pegado en el enlace', () => {
    expect(aloyCandidates(search, 'NSR0006')).toEqual([
      'https://www.aloyshop.com/es/precio-neto/8942-corvette.html',
    ]);
    expect(parseAloyProduct(product, 'https://www.aloyshop.com/es/precio-neto/8942-corvette.html?search_query=NSR0006')).toMatchObject({
      productUrl: 'https://www.aloyshop.com/es/precio-neto/8942-corvette.html',
      sku: 'NSR0006',
      price: 62.05,
      regularPrice: 68.95,
      inStock: true,
    });
  });

  test('un texto de sin stock no se publica como disponible', () => {
    const html = product
      .replace('InStock', 'OutOfStock')
      .replace('En Stock. Envío inmediato.', 'Este producto ya no est&aacute; en stock');
    expect(parseAloyProduct(html, 'https://www.aloyshop.com/es/precio-neto/8942-corvette.html').inStock).toBe(false);
  });
});

describe('clickslot', () => {
  const product = {
    title: 'Porsche 911 RSR',
    handle: 'porsche-911-rsr',
    variants: [
      {
        id: 1,
        sku: 'SC-6122R',
        price: '79.94',
        compare_at_price: '89.95',
        available: false,
      },
      { id: 2, sku: '', price: '10.00', available: true },
    ],
  };

  test('products.json trae el precio en euros y el agotado', () => {
    expect(shopifyCatalogHits(product, 'https://clickslot.shop')).toEqual([
      expect.objectContaining({
        sku: 'SC-6122R',
        price: 79.94,
        regularPrice: 89.95,
        inStock: false,
        productUrl: 'https://clickslot.shop/products/porsche-911-rsr?variant=1',
      }),
    ]);
  });

  test('la colección de coches pagina y el .js confirma la referencia', async () => {
    const page = Array.from({ length: 250 }, (_, index) => ({
      title: `Coche ${index}`,
      handle: `coche-${index}`,
      variants: [{ id: index, sku: `SC${index}R`, price: '10.00', compare_at_price: null, available: true }],
    }));
    const last = [product];
    const fetchPage = jest.fn(async (url) => {
      if (String(url).includes('/search/suggest.json')) {
        return JSON.stringify({ resources: { results: { products: [{ handle: 'porsche-911-rsr' }] } } });
      }
      if (String(url).endsWith('.js')) {
        return JSON.stringify({
          title: product.title,
          handle: product.handle,
          variants: [{ id: 1, sku: 'SC-6122R', price: 7994, compare_at_price: null, available: true }],
        });
      }
      const parsed = new URL(url);
      expect(parsed.searchParams.get('limit')).toBe('250');
      return JSON.stringify({ products: parsed.searchParams.get('page') === '1' ? page : last });
    });

    const products = await listShopifyCollection('https://clickslot.shop', 'coches', fetchPage);
    expect(products).toHaveLength(251);
    expect(products[250]).toMatchObject({ sku: 'SC-6122R', inStock: false, price: 79.94 });

    await expect(shopifyLookup('https://clickslot.shop', fetchPage, 'SC6122R')).resolves.toMatchObject({
      sku: 'SC-6122R',
      price: 79.94,
      inStock: true,
    });
  });

  test('la ficha HTML lee el precio publicado', () => {
    const html = `ShopifyAnalytics.lib.track("Viewed Product",{"currency":"EUR","name":"Porsche","price":"79.94","sku":"SC-6122R","available":true},undefined);`;
    expect(parseShopifyProduct(html, 'https://clickslot.shop/products/porsche-911-rsr')).toMatchObject({
      sku: 'SC-6122R',
      price: 79.94,
      inStock: true,
    });
  });
});

describe('cocheslot', () => {
  const card = ({
    path, title, category, skuDiv, price, regular, stock,
  }) => `
    <article class="product-miniature">
      <a href="https://www.cocheslot.net/${path}">${title}</a>
      <div class="product-category-name text-muted">${category}</div>
      <h2 class="h3 product-title"><a href="https://www.cocheslot.net/${path}">${title}</a></h2>
      <div class="product-reference text-muted">${skuDiv}</div>
      <span class="product-price" content="${price}">${price} €</span>
      ${regular ? `<span class="regular-price text-muted">${regular}</span>` : ''}
      ${stock || '<span class="badge badge-warning d-none product-last-items">Últimas unidades en stock</span>'}
    </article>`;

  test('el código sale del título, no del id interno, y el recambio se descarta', () => {
    const html = [
      card({
        path: 'mercedes/6160-MERCEDES-C-CLASS-ITC-1996-REF-SLOTIT.html',
        title: 'MERCEDES C - CLASS - ITC 1996 REFSICA54A. SLOT.IT',
        category: 'MERCEDES',
        skuDiv: '6160',
        price: '64.99',
        regular: '79,99 €',
      }),
      card({
        path: 'ejes/1431-TREN-DE-RUEDAS.html',
        title: 'TREN DE RUEDAS POSTERIOR REF.8852 TECNITOYS',
        category: 'EJES',
        skuDiv: '1431',
        price: '4.99',
      }),
      card({
        path: 'nissan/1-nissan.html',
        title: 'NISSAN R89C Nº24 LE MANS 1984 REF.CA28H SLOT.IT',
        category: 'NISSAN',
        skuDiv: '1',
        price: '70.00',
        stock: '<span class="badge badge-danger">Agotado</span>',
      }),
    ].join('');

    const hits = cocheslotListingHits(html);
    expect(hits.map((hit) => hit.sku)).toEqual(['SICA54A', '8852', 'CA28H']);
    expect(hits[0]).toMatchObject({ price: 64.99, regularPrice: 79.99, inStock: true });
    expect(hits[2].inStock).toBe(false);
    expect(isSpareProduct(hits[0])).toBe(false);
    expect(isSpareProduct(hits[1])).toBe(true);
    expect(cocheslotCandidates(html, 'SICA54A')).toEqual([
      'https://www.cocheslot.net/mercedes/6160-MERCEDES-C-CLASS-ITC-1996-REF-SLOTIT.html',
    ]);
  });

  test('el listado pagina hasta que no hay página siguiente', async () => {
    const page = (sku, next) => `
      <article class="product-miniature">
        <a href="https://www.cocheslot.net/lotus/${sku}.html">Lotus REF.${sku} SUPERSLOT</a>
        <h2 class="h3 product-title"><a href="https://www.cocheslot.net/lotus/${sku}.html">Lotus REF.${sku}</a></h2>
        <div class="product-category-name">LOTUS</div>
        <span class="product-price" content="39.99">39,99 €</span>
      </article>
      ${next}`;
    const fetchPage = jest.fn(async (url) => (
      String(url).includes('page=2')
        ? page('H4301', '')
        : `${page('CA28H', '<a href="https://www.cocheslot.net/7919-vehiculos?page=2">2</a><a href="https://www.cocheslot.net/7919-vehiculos?page=20">20</a>')}`
    ));

    const products = await listCocheslotCatalog(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(products.map((hit) => hit.sku)).toEqual(['CA28H', 'H4301']);
  });

  test('la ficha usa el precio del producto y no el de los relacionados', () => {
    const html = `
      <h1 class="h1 page-title"><span>MERCEDES C - CLASS - ITC 1996 REFSICA54A. SLOT.IT</span></h1>
      <div class="product-reference"><span>6160</span></div>
      <div class="product-prices js-product-prices">
        <span class="js-product-availability badge badge-warning product-last-items">Últimas unidades</span>
        <span class="product-price current-price-value" content="64.99">64,99 €</span>
        <span class="regular-price text-muted">79,99 €</span>
      </div>
      <article class="product-miniature">
        <span class="product-price" content="10.00">10,00 €</span>
      </article>
    `;
    expect(parseCocheslotProduct(html, 'https://www.cocheslot.net/mercedes/6160-coche.html?q=1')).toMatchObject({
      sku: 'SICA54A',
      price: 64.99,
      regularPrice: 79.99,
      inStock: true,
      productUrl: 'https://www.cocheslot.net/mercedes/6160-coche.html',
      categorySlugs: ['mercedes'],
    });
  });
});
