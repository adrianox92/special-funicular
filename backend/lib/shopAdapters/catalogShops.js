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
  parseEuroAmount,
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

function parseJoaquiProduct(html, pageUrl) {
  const ld = parseJsonLdProduct(html, pageUrl);
  const price = String(html || '').match(/text-precio[^>]*>([^<]+)/i);
  const ref = String(html || '').match(/<span class="key[^"]*"[^>]*>\s*Ref\s*<\/span>\s*<span class="value">([^<]+)/i);
  const units = String(html || '').match(/(\d+)\s+Unidades en stock/i);
  const soldOut = Boolean(units && Number(units[1]) === 0);
  const addable = /add2cart/i.test(html || '');
  return {
    productUrl: String(pageUrl || '').split('?')[0],
    price: parseEuroAmount(price && price[1]) ?? (ld && ld.price),
    currency: 'EUR',
    inStock: addable ? !soldOut : Boolean(ld && ld.inStock),
    sku: (ref && ref[1].trim()) || (ld && ld.sku) || null,
    gtin: (ld && ld.gtin) || null,
  };
}

function joaquiCandidates(html, query) {
  const urls = [];
  for (const card of String(html || '').split('product-card').slice(1)) {
    if (!textHasCode(card, query)) continue;
    const href = card.match(/href="(https:\/\/www\.joaquimoslot\.com\/[^"?#]+)/i);
    if (href) urls.push(href[1]);
  }
  return [...new Set(urls)];
}

function parseCricProduct(html, pageUrl) {
  const price = String(html || '').match(/itemprop="price"\s+content="([0-9.]+)"/i);
  const availability = String(html || '').match(/itemprop="availability"\s+content="([^"]+)"/i);
  return {
    productUrl: pageUrl,
    price: price ? parseEuroAmount(price[1]) : null,
    currency: 'EUR',
    inStock: /schema\.org\/InStock/i.test(availability ? availability[1] : ''),
    sku: null,
    gtin: null,
  };
}

async function criccracLookup(query, fetchImpl = fetch) {
  const body = new URLSearchParams({
    'menu_data[parameter_id]': 'criccrac_website_list',
    'menu_data[session_variable]': 'lista-de-productos',
    'menu_data[limit]': '20',
    'menu_data[specific][Itemid]': '1891',
    mode: 'ajax',
    reset_form: 'false',
    userid: '0',
    'form_data[referencia]': query,
    'form_data[start]': '0',
    'form_data[action_type]': 'filter',
    'form_data[action_subtype]': 'referencia',
    'form_data[dual_system_module]': 'slot',
  });
  const res = await fetchImpl('https://www.criccrac.com/index.php?option=com_paracom&task=tablerender.get_tablerender_data', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'SlotDatabaseCatalogBot/1.0 (+https://www.slotdatabase.es)',
      accept: 'application/json',
    },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const row = Object.values(json.results || {}).find((item) => sameSku(item && item.product_code, query));
  if (!row) return null;
  const slots = row.custom_slots || {};
  const href = String(slots.thumbnail_link || '').match(/href="([^"]+)"/);
  const shown = String(slots.item_add_to_cart_and_price || '').match(/price_with_vat[^>]*>([^<]+)/i);
  return {
    productUrl: href ? absoluteUrl(href[1], 'https://www.criccrac.com') : null,
    price: parseEuroAmount(shown && shown[1]),
    currency: 'EUR',
    inStock: String(row.is_salable) === '1',
    sku: row.product_code,
    gtin: null,
  };
}

const HTYC_SEARCH = 'https://eu-fra4-storefront-api.ecwid.com/storefront/api/v1/32502256/catalog/search';

function htycProductHit(row) {
  const raw = row && row.seo && row.seo.jsonLD;
  if (!raw) return null;
  const parsed = parseJsonLdProduct(
    `<script type="application/ld+json">${raw}</script>`,
    'https://www.htyc-slotshop.es/',
  );
  if (!parsed || !parsed.sku) return null;
  const slug = row.slugs && row.slugs.forRouteWithId;
  const id = row.identifier && row.identifier.productId;
  if (slug && id) parsed.productUrl = `https://www.htyc-slotshop.es/buscador/${slug}-p${id}`;
  return parsed;
}

async function htycPage(offset, fetchImpl) {
  const res = await fetchImpl(HTYC_SEARCH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://www.htyc-slotshop.es',
      referer: 'https://www.htyc-slotshop.es/',
    },
    body: JSON.stringify({ pagination: { limit: 100, offset } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.products) ? json.products : [];
}

async function listHtycProducts(fetchImpl = fetch) {
  const products = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const rows = await htycPage(offset, fetchImpl);
    for (const row of rows) {
      const hit = htycProductHit(row);
      if (hit) products.push(hit);
    }
    if (rows.length < 100) break;
  }
  return products;
}

function parseSlotmaniaProduct(html, pageUrl) {
  const hit = parseJsonLdProduct(html, pageUrl);
  if (!hit) return null;
  const regular = String(html || '').match(/regular-price[^>]*>([^<]+)/i);
  const regularPrice = parseEuroAmount(regular && regular[1]);
  if (regularPrice != null && hit.price != null && regularPrice > hit.price) {
    hit.regularPrice = regularPrice;
  }
  const availability = String(html || '').match(/class="([^"]*\bjs-product-availability\b[^"]*)"/i);
  if (availability) {
    if (/product-unavailable|out-of-stock/i.test(availability[1])) hit.inStock = false;
    else if (/\bproduct-available\b/i.test(availability[1])) hit.inStock = true;
  }
  return hit;
}

function parseAloyProduct(html, pageUrl) {
  const sku = String(html || '').match(/itemprop="sku"[^>]*>\s*([^<]+)/i);
  if (!sku || !sku[1].trim()) return null;
  const price = String(html || '').match(/id="our_price_display"[^>]*>\s*([^<]+)/i);
  const oldPrice = String(html || '').match(/id="old_price_display"[^>]*>\s*([^<]+)/i);
  const availability = String(html || '').match(/itemprop="availability"\s+href="([^"]+)"/i);
  const availabilityText = String(html || '').match(/id="availability_value"[^>]*>([^<]+)/i);
  const text = (availabilityText ? availabilityText[1] : '').replace(/&aacute;/gi, 'á');
  const soldOut = /no est[aá] en stock|agotado|fuera de stock/i.test(text);
  const onSale = /schema\.org\/(?:InStock|LimitedAvailability)/i.test(availability ? availability[1] : '')
    || (/en stock/i.test(text) && !soldOut);
  const current = parseEuroAmount(price && price[1]);
  const regular = parseEuroAmount(oldPrice && oldPrice[1]);
  const hit = {
    productUrl: String(pageUrl || '').split('?')[0],
    price: current,
    currency: 'EUR',
    inStock: onSale && !soldOut,
    sku: sku[1].trim(),
    gtin: null,
  };
  if (regular != null && current != null && regular > current) hit.regularPrice = regular;
  return hit;
}

function aloyCandidates(html, query) {
  const source = String(html || '');
  const start = source.search(/class="product_list/i);
  if (start < 0) return [];
  const end = source.indexOf('</ul>', start);
  const list = source.slice(start, end > start ? end : undefined);
  const urls = [];
  for (const card of list.split('<li class="ajax_block_product').slice(1)) {
    const reference = card.match(/itemprop="reference"[^>]*>\s*([^<]+)/i);
    if (!reference || !textHasCode(reference[1], query)) continue;
    const href = card.match(/href="(https:\/\/www\.aloyshop\.com\/es\/[^"?]+\.html)/i);
    if (!href || /\/descatalogados\//i.test(href[1])) continue;
    urls.push(href[1]);
  }
  return [...new Set(urls)];
}

function slotmaniaCandidates(html, query) {
  const urls = [];
  for (const card of String(html || '').split('product-miniature').slice(1)) {
    if (!textHasCode(card, query)) continue;
    const href = card.match(/href="(https:\/\/slotmania\.es\/es\/[^"?#]+\.html)"/i);
    if (href) urls.push(href[1]);
  }
  return [...new Set(urls)];
}

async function htycLookup(query, fetchImpl = fetch) {
  const products = await listHtycProducts(fetchImpl);
  return products.find((hit) => sameSku(hit.sku, query)) || null;
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
  createShopAdapter({
    key: 'joaquimoslot',
    origin: 'https://www.joaquimoslot.com',
    searchUrl: (query) => `https://www.joaquimoslot.com/index.php?main_page=advanced_search_result&keyword=${encodeURIComponent(query)}`,
    parse: parseJoaquiProduct,
    candidates: joaquiCandidates,
  }),
  createShopAdapter({
    key: 'criccrac',
    origin: 'https://www.criccrac.com',
    lookupOnly: true,
    lookup: (_fetchPage, query) => criccracLookup(query),
    searchUrl: () => 'https://www.criccrac.com/',
    parse: parseCricProduct,
    candidates: () => [],
  }),
  withListProducts(createShopAdapter({
    key: 'htyc-slotshop',
    origin: 'https://www.htyc-slotshop.es',
    lookupOnly: true,
    lookup: (_fetchPage, query) => htycLookup(query),
    searchUrl: () => 'https://www.htyc-slotshop.es/',
    parse: parseJsonLdProduct,
    candidates: () => [],
  }), () => listHtycProducts()),
  createShopAdapter({
    key: 'aloyshop',
    origin: 'https://www.aloyshop.com',
    searchUrl: (query) => `https://www.aloyshop.com/es/buscar?controller=search&orderby=quantity&orderway=desc&search_query=${encodeURIComponent(query)}`,
    parse: parseAloyProduct,
    candidates: aloyCandidates,
  }),
  createShopAdapter({
    key: 'slotmania',
    origin: 'https://slotmania.es',
    searchUrl: (query) => `https://slotmania.es/es/busqueda?search_query=${encodeURIComponent(query)}`,
    parse: parseSlotmaniaProduct,
    candidates: slotmaniaCandidates,
  }),
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
  parseJoaquiProduct,
  joaquiCandidates,
  parseCricProduct,
  criccracLookup,
  htycProductHit,
  listHtycProducts,
  parseSlotmaniaProduct,
  slotmaniaCandidates,
  parseAloyProduct,
  aloyCandidates,
};
