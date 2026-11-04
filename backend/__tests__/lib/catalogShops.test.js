const { createShopAdapter, wooStoreLookup } = require('../../lib/shopAdapters/catalogShops');
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
});
