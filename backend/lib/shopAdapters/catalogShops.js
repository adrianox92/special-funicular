const { fetchShopPage } = require('./fetchShopPage');
const {
  sameSku,
  absoluteUrl,
  itemListUrls,
  productListCards,
  cardProductUrl,
  textHasCode,
  anchorsWithCode,
  productAnchors,
  parseJsonLdProduct,
  parseWooProduct,
  parseEvotecProduct,
  parseDataProduct,
  searchQueries,
} = require('./productParse');

const MAX_CANDIDATES = 3;

function hitMatches(hit, { reference, ean }) {
  if (!hit) return false;
  if (sameSku(hit.sku, reference)) return true;
  const gtin = String(hit.gtin || '').replace(/\D/g, '');
  const wanted = String(ean || '').replace(/\D/g, '');
  return Boolean(gtin && wanted && gtin === wanted);
}

function toPublicHit(hit) {
  const publicHit = {
    productUrl: hit.productUrl,
    price: hit.price,
    currency: hit.currency || 'EUR',
    inStock: Boolean(hit.inStock),
  };
  if (hit.regularPrice != null) publicHit.regularPrice = hit.regularPrice;
  return publicHit;
}

function createShopAdapter(config, deps = {}) {
  const fetchPage = deps.fetchPage || fetchShopPage;

  async function readProduct(url) {
    const html = await fetchPage(url);
    if (!html) return null;
    const hit = config.parse(html, url);
    if (!hit || !hit.productUrl) {
      throw new Error('No se ha podido leer la ficha');
    }
    return hit;
  }

  return {
    key: config.key,
    async findByReference({ reference, ean }) {
      let lastError = null;
      let readOk = false;
      if (config.lookup) {
        let lookupOk = false;
        for (const query of searchQueries(reference, ean)) {
          try {
            const hit = await config.lookup(fetchPage, query);
            lookupOk = true;
            if (hit && hitMatches(hit, { reference, ean })) return toPublicHit(hit);
          } catch (err) {
            lastError = err;
          }
        }
        if (config.lookupOnly) {
          if (!lookupOk && lastError) throw lastError;
          return null;
        }
      }
      for (const query of searchQueries(reference, ean)) {
        const searchHtml = await fetchPage(config.searchUrl(query));
        if (!searchHtml) continue;
        const candidates = config.candidates(searchHtml, query).slice(0, MAX_CANDIDATES);
        for (const candidate of candidates) {
          try {
            const hit = await readProduct(candidate);
            readOk = true;
            if (hit && hitMatches(hit, { reference, ean })) return toPublicHit(hit);
          } catch (err) {
            lastError = err;
          }
        }
      }
      if (!readOk && lastError) throw lastError;
      return null;
    },
    async checkProduct(productUrl) {
      const url = absoluteUrl(productUrl, config.origin);
      if (!url) throw new Error('URL de producto inválida');
      const hit = await readProduct(url);
      return hit ? toPublicHit(hit) : null;
    },
  };
}

function withListProducts(adapter, listProducts) {
  if (!listProducts) return adapter;
  return {
    ...adapter,
    listProducts: () => listProducts(fetchShopPage),
  };
}

function evotecCandidates(html, query) {
  const urls = [];
  for (const card of productListCards(html)) {
    if (!textHasCode(card, query)) continue;
    const url = cardProductUrl(card, 'https://evotecshop.com');
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

function listedOrLinked(html, origin, query) {
  const fromList = itemListUrls(html, origin);
  if (fromList.length > 0) return fromList;
  const coded = anchorsWithCode(html, origin, query);
  if (coded.length > 0) return coded;
  const start = html.search(/id="js-product-list"/i);
  if (start < 0) return [];
  const urls = [];
  const seen = new Set();
  for (const anchor of productAnchors(html.slice(start, start + 40000), origin)) {
    if (seen.has(anchor.url)) continue;
    seen.add(anchor.url);
    urls.push(anchor.url);
  }
  return urls;
}

function wooPrice(raw, minorUnit) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Number.isFinite(Number(minorUnit)) ? Number(minorUnit) : 2;
  return Math.round((amount / (10 ** minor)) * 100) / 100;
}

async function wooStoreLookup(origin, fetchPage, query) {
  const raw = await fetchPage(`${origin}/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`);
  if (!raw) return null;
  let rows;
  try {
    rows = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const row = rows.find((item) => sameSku(item && item.sku, query));
  if (!row || typeof row.permalink !== 'string') return null;
  const prices = row.prices || {};
  return {
    productUrl: row.permalink,
    price: wooPrice(prices.price, prices.currency_minor_unit),
    regularPrice: wooPrice(prices.regular_price, prices.currency_minor_unit),
    currency: prices.currency_code || 'EUR',
    inStock: Boolean(row.is_in_stock),
    sku: row.sku,
    gtin: null,
  };
}

const WOO_PAGE_SIZE = 100;
const WOO_MAX_PAGES = 50;

function wooProductHit(row) {
  if (!row || typeof row.permalink !== 'string') return null;
  const prices = row.prices || {};
  return {
    sku: row.sku || '',
    productUrl: row.permalink,
    price: wooPrice(prices.price, prices.currency_minor_unit),
    regularPrice: wooPrice(prices.regular_price, prices.currency_minor_unit),
    currency: prices.currency_code || 'EUR',
    inStock: Boolean(row.is_in_stock),
  };
}

/**
 * Listado completo de la Store API. Sin stock_status ni on_sale:
 * el stock sale de is_in_stock y el precio tachado de regular_price.
 * category acota la tienda (coches en Model Hobby Red).
 */
async function listWooCatalog(origin, fetchPage, { category } = {}) {
  const products = [];
  for (let page = 1; page <= WOO_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      per_page: String(WOO_PAGE_SIZE),
      page: String(page),
      orderby: 'date',
      order: 'desc',
    });
    if (category) params.set('category', String(category));
    const raw = await fetchPage(`${origin}/wp-json/wc/store/v1/products?${params}`);
    if (!raw) throw new Error('Listado WooCommerce vacío');
    let rows;
    try {
      rows = JSON.parse(raw);
    } catch {
      throw new Error('Listado WooCommerce no es JSON');
    }
    if (!Array.isArray(rows)) throw new Error('Listado WooCommerce no es una lista');
    for (const row of rows) {
      const hit = wooProductHit(row);
      if (hit) products.push(hit);
    }
    if (rows.length < WOO_PAGE_SIZE) return products;
  }
  throw new Error('Listado WooCommerce incompleto');
}

const catalogShopAdapters = [
  createShopAdapter({
    key: 'evotec',
    origin: 'https://evotecshop.com',
    searchUrl: (query) => `https://evotecshop.com/en/search?controller=search&search_query=${encodeURIComponent(query)}`,
    parse: parseEvotecProduct,
    candidates: evotecCandidates,
  }),
  createShopAdapter({
    key: 'ministry-of-hobby',
    origin: 'https://www.ministryofhobby.com',
    searchUrl: (query) => `https://www.ministryofhobby.com/es/buscar?controller=search&s=${encodeURIComponent(query)}`,
    parse: parseDataProduct,
    candidates: (html) => itemListUrls(html, 'https://www.ministryofhobby.com'),
  }),
  createShopAdapter({
    key: 'slot-car-union',
    origin: 'https://www.slotcar-union.com',
    searchUrl: (query) => `https://www.slotcar-union.com/en/search?controller=search&s=${encodeURIComponent(query)}`,
    parse: parseJsonLdProduct,
    candidates: (html, query) => listedOrLinked(html, 'https://www.slotcar-union.com', query),
  }),
  withListProducts(createShopAdapter({
    key: 'model-hobbyred',
    origin: 'https://model-hobbyred.com',
    lookupOnly: true,
    lookup: (fetchPage, query) => wooStoreLookup('https://model-hobbyred.com', fetchPage, query),
    searchUrl: (query) => `https://model-hobbyred.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`,
    parse: parseWooProduct,
    candidates: () => [],
  }), (fetchPage) => listWooCatalog('https://model-hobbyred.com', fetchPage, { category: 22 })),
  withListProducts(createShopAdapter({
    key: 'trofeslot',
    origin: 'https://trofeslot.com',
    lookupOnly: true,
    lookup: (fetchPage, query) => wooStoreLookup('https://trofeslot.com', fetchPage, query),
    searchUrl: (query) => `https://trofeslot.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`,
    parse: parseWooProduct,
    candidates: () => [],
  }), (fetchPage) => listWooCatalog('https://trofeslot.com', fetchPage)),
];

module.exports = {
  createShopAdapter,
  catalogShopAdapters,
  wooStoreLookup,
  listWooCatalog,
};
