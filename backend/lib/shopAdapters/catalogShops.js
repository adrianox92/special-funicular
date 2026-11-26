const { fetchShopPage } = require('./fetchShopPage');
const {
  sameSku,
  normalizeCode,
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
  enrichShopProduct,
  isSpareProduct,
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
    const parsed = config.parse(html, url);
    if (!parsed || !parsed.productUrl) {
      throw new Error('No se ha podido leer la ficha');
    }
    const hit = enrichShopProduct(parsed, html);
    if (isSpareProduct(hit)) return null;
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
            if (hit && !isSpareProduct(hit) && hitMatches(hit, { reference, ean })) return toPublicHit(hit);
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
  const row = rows.find((item) => {
    const hit = wooProductHit(item);
    return hit && sameSku(hit.sku, query) && !isSpareProduct(hit);
  });
  return row ? wooProductHit(row) : null;
}

const WOO_PAGE_SIZE = 100;
const WOO_MAX_PAGES = 50;

function wooProductHit(row) {
  if (!row || typeof row.permalink !== 'string') return null;
  const prices = row.prices || {};
  const categories = Array.isArray(row.categories) ? row.categories : [];
  return {
    sku: row.sku || '',
    productUrl: row.permalink,
    price: wooPrice(prices.price, prices.currency_minor_unit),
    regularPrice: wooPrice(prices.regular_price, prices.currency_minor_unit),
    currency: prices.currency_code || 'EUR',
    inStock: Boolean(row.is_in_stock),
    name: row.name || '',
    categorySlugs: categories.map((cat) => cat && (cat.slug || cat.name)).filter(Boolean),
  };
}

/**
 * Listado completo de la Store API. No filtra on_sale.
 * El catálogo visible a veces oculta agotados (Speed Slot): por eso se pide
 * también outofstock y onbackorder. El stock sale de is_in_stock y el
 * precio tachado de regular_price.
 * category acota la tienda (coches: 22 en Model Hobby Red, 344 en Speed Slot).
 */
const WOO_STOCK_PASSES = [null, 'outofstock', 'onbackorder'];

async function listWooCatalog(origin, fetchPage, { category } = {}) {
  const products = [];
  const seen = new Set();
  for (const stockStatus of WOO_STOCK_PASSES) {
    for (let page = 1; page <= WOO_MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        per_page: String(WOO_PAGE_SIZE),
        page: String(page),
        orderby: 'date',
        order: 'desc',
      });
      if (category) params.set('category', String(category));
      if (stockStatus) params.set('stock_status', stockStatus);
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
        if (!hit || seen.has(hit.productUrl)) continue;
        seen.add(hit.productUrl);
        products.push(hit);
      }
      if (rows.length < WOO_PAGE_SIZE) break;
      if (page === WOO_MAX_PAGES) throw new Error('Listado WooCommerce incompleto');
    }
  }
  return products;
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

/** Criccrac guarda SC-6350R y TOP-7301. El catálogo suele llevar SC6350R y TOP7301, y el filtro es literal. */
function criccracAttempts(query) {
  const attempts = [];
  const add = (value) => {
    const text = String(value || '').trim();
    if (text.length < 4) return;
    if (attempts.some((item) => item.toUpperCase() === text.toUpperCase())) return;
    attempts.push(text);
  };
  add(query);
  const split = normalizeCode(query).match(/^([A-Z]{2,4})(\d.+)$/);
  if (split) add(`${split[1]}-${split[2]}`);
  return attempts;
}

async function criccracSearch(query, fetchImpl) {
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
  return Object.values(json.results || {});
}

async function criccracLookup(query, fetchImpl = fetch) {
  for (const attempt of criccracAttempts(query)) {
    const rows = await criccracSearch(attempt, fetchImpl);
    const row = rows.find((item) => {
      if (!sameSku(item && item.product_code, query)) return false;
      return !isSpareProduct(criccracHit(item));
    });
    if (row) return criccracHit(row);
  }
  return null;
}

function criccracHit(row) {
  const slots = (row && row.custom_slots) || {};
  const href = String(slots.thumbnail_link || '').match(/href="([^"]+)"/);
  const shown = String(slots.item_add_to_cart_and_price || '').match(/price_with_vat[^>]*>([^<]+)/i);
  const name = String(row.product_name || row.name || slots.item_name || '').trim();
  return {
    productUrl: href ? absoluteUrl(href[1], 'https://www.criccrac.com') : null,
    price: parseEuroAmount(shown && shown[1]),
    currency: 'EUR',
    inStock: String(row.is_salable) === '1',
    sku: row.product_code,
    gtin: null,
    name: name || null,
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

const SLOTMANIA_CARS = 'https://slotmania.es/es/168-coches';
const SLOTMANIA_MAX_PAGES = 40;

function slotmaniaListingHits(html) {
  const hits = [];
  for (const card of String(html || '').split(/<article[^>]*\bproduct-miniature\b/i).slice(1)) {
    const href = card.match(/href="(https:\/\/slotmania\.es\/es\/[^"?#]+\.html)"/i);
    const sku = card.match(/product-reference[^>]*>\s*([^<]+)/i);
    const price = card.match(/class="product-price"[^>]*content="([^"]+)"/i);
    const name = card.match(/product-title[\s\S]*?<a[^>]*>([^<]+)/i);
    if (!href || !sku || !sku[1].trim()) continue;
    const unavailable = /product-unavailable/i.test(card);
    const available = /product-available/i.test(card);
    hits.push({
      productUrl: href[1],
      sku: sku[1].trim(),
      name: name ? name[1].trim() : '',
      price: parseEuroAmount(price && price[1]),
      currency: 'EUR',
      inStock: available && !unavailable,
      categorySlugs: ['coches'],
    });
  }
  return hits;
}

function slotmaniaHasNext(html, page) {
  return new RegExp(`[?&]page=${page + 1}(?:&|"|')`).test(String(html || ''));
}

/**
 * A partir de COCHES en el menú lateral. El padre no enseña los coches
 * guardados solo en una subcategoría (marca, GT, kit, 1/43).
 */
function slotmaniaCarCategories(html) {
  const urls = [SLOTMANIA_CARS];
  const seen = new Set(urls);
  const source = String(html || '');
  const marker = source.lastIndexOf('/168-coches');
  const slice = marker >= 0 ? source.slice(marker) : '';
  for (const match of slice.matchAll(/href="(https:\/\/slotmania\.es\/es\/\d+-[^"?#]+)"/g)) {
    const url = match[1];
    if (url.endsWith('/168-coches') || seen.has(url)) continue;
    if (/recambios|accesorios|chasis|neumaticos|circuitos|tornilleria|trencillas|llantas|pinones|coronas|mandos|herramientas|pinturas|pistas|mercadillo|ofertas|motores|cojinetes|correas|ejes|calcomanias|cuentavueltas|separadores|soportes|suspensiones|tuercas|arandelas|cables/i.test(url)) {
      break;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

async function appendSlotmaniaCategory(fetchPage, products, seen, categoryUrl, firstHtml) {
  for (let page = 1; page <= SLOTMANIA_MAX_PAGES; page += 1) {
    const raw = page === 1 && firstHtml && categoryUrl === SLOTMANIA_CARS
      ? firstHtml
      : await fetchPage(page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`);
    if (!raw) {
      if (categoryUrl === SLOTMANIA_CARS && page === 1) throw new Error('Listado Slotmania vacío');
      return;
    }
    const hits = slotmaniaListingHits(raw);
    if (hits.length === 0) return;
    let added = 0;
    for (const hit of hits) {
      if (seen.has(hit.productUrl)) continue;
      seen.add(hit.productUrl);
      products.push(hit);
      added += 1;
    }
    if (!slotmaniaHasNext(raw, page) || added === 0) return;
    if (page === SLOTMANIA_MAX_PAGES) throw new Error('Listado Slotmania incompleto');
  }
}

/** Categorías de coches. La miniatura trae referencia, precio y stock. */
async function listSlotmaniaCatalog(fetchPage) {
  const first = await fetchPage(SLOTMANIA_CARS);
  if (!first) throw new Error('Listado Slotmania vacío');
  const products = [];
  const seen = new Set();
  for (const categoryUrl of slotmaniaCarCategories(first)) {
    await appendSlotmaniaCategory(
      fetchPage,
      products,
      seen,
      categoryUrl,
      categoryUrl === SLOTMANIA_CARS ? first : null,
    );
  }
  if (products.length === 0) throw new Error('Listado Slotmania vacío');
  return products;
}

const SHOPIFY_PAGE_SIZE = 250;
const SHOPIFY_MAX_PAGES = 20;

function shopifyAmount(raw, { cents = false } = {}) {
  if (raw == null || raw === '') return null;
  if (cents) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Math.round(amount) / 100;
  }
  const amount = parseEuroAmount(raw);
  if (amount == null || amount <= 0) return null;
  return amount;
}

function shopifyVariantHit(product, variant, origin, { cents = false, variants = 1 } = {}) {
  const sku = String(variant && variant.sku || '').trim();
  if (!product || !product.handle || !sku) return null;
  const price = shopifyAmount(variant.price, { cents });
  const regular = shopifyAmount(variant.compare_at_price, { cents });
  const variantQuery = variants > 1 && variant.id ? `?variant=${variant.id}` : '';
  const hit = {
    sku,
    name: product.title || product.name || '',
    productUrl: `${origin}/products/${product.handle}${variantQuery}`,
    price,
    currency: 'EUR',
    inStock: Boolean(variant.available),
    categorySlugs: ['coches'],
  };
  if (regular != null && price != null && regular > price) hit.regularPrice = regular;
  return hit;
}

function shopifyCatalogHits(product, origin) {
  const variants = Array.isArray(product && product.variants) ? product.variants : [];
  return variants
    .map((variant) => shopifyVariantHit(product, variant, origin, { variants: variants.length }))
    .filter(Boolean);
}

/** products/{handle}.js guarda el precio en céntimos. products.json, en euros. */
function shopifyJsHits(product, origin) {
  const variants = Array.isArray(product && product.variants) ? product.variants : [];
  return variants
    .map((variant) => shopifyVariantHit(product, variant, origin, { cents: true, variants: variants.length }))
    .filter(Boolean);
}

function parseShopifyProduct(html, pageUrl) {
  const track = String(html || '').match(/track\("Viewed Product",(\{[\s\S]*?\})\s*,/);
  if (!track) return null;
  let data;
  try {
    data = JSON.parse(track[1]);
  } catch {
    return null;
  }
  if (!data || !data.sku) return null;
  const handle = String(pageUrl || '').match(/\/products\/([^/?#]+)/);
  return {
    productUrl: String(pageUrl || '').split('?')[0],
    sku: data.sku,
    name: data.name || '',
    price: shopifyAmount(data.price),
    currency: data.currency || 'EUR',
    inStock: Boolean(data.available),
    categorySlugs: ['coches'],
    handle: handle && handle[1],
  };
}

/**
 * Colección pública de Shopify. Sin clave: /collections/{handle}/products.json.
 * Click Slot guarda los coches en `coches` (rally, GT y F1 incluidos).
 */
async function listShopifyCollection(origin, handle, fetchPage) {
  const products = [];
  const seen = new Set();
  for (let page = 1; page <= SHOPIFY_MAX_PAGES; page += 1) {
    const raw = await fetchPage(`${origin}/collections/${handle}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`);
    if (!raw) throw new Error('Listado Shopify vacío');
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error('Listado Shopify no es JSON');
    }
    const rows = json && json.products;
    if (!Array.isArray(rows)) throw new Error('Listado Shopify no es una lista');
    for (const row of rows) {
      for (const hit of shopifyCatalogHits(row, origin)) {
        const key = `${hit.sku}\n${hit.productUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);
        products.push(hit);
      }
    }
    if (rows.length < SHOPIFY_PAGE_SIZE) return products;
    if (page === SHOPIFY_MAX_PAGES) throw new Error('Listado Shopify incompleto');
  }
  return products;
}

async function shopifyLookup(origin, fetchPage, query) {
  const params = new URLSearchParams({
    q: query,
    'resources[type]': 'product',
    'resources[limit]': '8',
    'resources[options][fields]': 'title,variants.sku,tag',
  });
  const raw = await fetchPage(`${origin}/search/suggest.json?${params}`);
  if (!raw) return null;
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const rows = json && json.resources && json.resources.results && json.resources.results.products;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || !row.handle) continue;
    const detailRaw = await fetchPage(`${origin}/products/${row.handle}.js`);
    if (!detailRaw) continue;
    let detail;
    try {
      detail = JSON.parse(detailRaw);
    } catch {
      continue;
    }
    const hit = shopifyJsHits(detail, origin).find((item) => sameSku(item.sku, query) && !isSpareProduct(item));
    if (hit) return hit;
  }
  return null;
}

async function htycLookup(query, fetchImpl = fetch) {
  const products = await listHtycProducts(fetchImpl);
  return products.find((hit) => sameSku(hit.sku, query) && !isSpareProduct(hit)) || null;
}

const COCHESLOT_CARS = 'https://www.cocheslot.net/7919-vehiculos';
const COCHESLOT_MAX_PAGES = 400;

function cocheslotText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** La referencia de PrestaShop es el id interno. El código de catálogo va en el título: REFSICA54A, REF.H4301. */
function cocheslotReference(value) {
  const match = cocheslotText(value).match(/\bREF[.\-]?\s*([A-Z]{0,6}\d[A-Z0-9]{2,})\b/i);
  return match ? match[1] : '';
}

function cocheslotPathSlug(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (parts.length >= 2 && /^\d+-/.test(last)) {
      return decodeURIComponent(parts[parts.length - 2]).toLowerCase();
    }
  } catch {
    /* una URL rara no aporta categoría */
  }
  return '';
}

function cocheslotCardInStock(card) {
  if (/product-unavailable/i.test(card)) return false;
  for (const badge of String(card).matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)) {
    if (!/class="[^"]*\bbadge\b/i.test(badge[1]) || /\bd-none\b/i.test(badge[1])) continue;
    if (/agotado|sin stock|fuera de stock|no disponible/i.test(badge[2])) return false;
  }
  return true;
}

/**
 * Coches de /7919-vehiculos. El padre también enseña recambios; la categoría
 * de la miniatura y el primer tramo de la URL los descartan después.
 */
function cocheslotListingHits(html) {
  const hits = [];
  for (const card of String(html || '').split(/<article[^>]*\bproduct-miniature\b/i).slice(1)) {
    const href = card.match(/href="(https:\/\/www\.cocheslot\.net\/[^"?#]+\.html)"/i);
    if (!href) continue;
    const name = cocheslotText((card.match(/product-title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1]);
    const sku = cocheslotReference(name) || cocheslotReference(decodeURIComponent(href[1]));
    if (!sku) continue;
    const categoryName = cocheslotText((card.match(/product-category-name[^>]*>([^<]+)/i) || [])[1]);
    const pathSlug = cocheslotPathSlug(href[1]);
    const categorySlugs = [];
    if (pathSlug) categorySlugs.push(pathSlug);
    if (categoryName) categorySlugs.push(categoryName.toLowerCase());
    const price = parseEuroAmount((card.match(/class="product-price"[^>]*content="([^"]+)"/i) || [])[1]);
    const regular = parseEuroAmount((card.match(/class="regular-price[^"]*"[^>]*>([^<]+)/i) || [])[1]);
    const hit = {
      productUrl: href[1],
      sku,
      name,
      price,
      currency: 'EUR',
      inStock: cocheslotCardInStock(card),
      categorySlugs,
    };
    if (regular != null && price != null && regular > price) hit.regularPrice = regular;
    hits.push(hit);
  }
  return hits;
}

function cocheslotHasNext(html, page) {
  return new RegExp(`[?&]page=${page + 1}(?:&|"|')`).test(String(html || ''));
}

function cocheslotArticleCount(html) {
  return (String(html || '').match(/<article[^>]*\bproduct-miniature\b/gi) || []).length;
}

/** Listado de vehículos. Una página a medias no se da por buena: faltan coches y se marcarían agotados. */
async function listCocheslotCatalog(fetchPage) {
  const products = [];
  const seen = new Set();
  for (let page = 1; page <= COCHESLOT_MAX_PAGES; page += 1) {
    const url = page === 1 ? COCHESLOT_CARS : `${COCHESLOT_CARS}?page=${page}`;
    const raw = await fetchPage(url);
    if (!raw || cocheslotArticleCount(raw) === 0) {
      throw new Error(page === 1 ? 'Listado Cocheslot vacío' : 'Listado Cocheslot incompleto');
    }
    for (const hit of cocheslotListingHits(raw)) {
      if (seen.has(hit.productUrl)) continue;
      seen.add(hit.productUrl);
      products.push(hit);
    }
    if (!cocheslotHasNext(raw, page)) {
      if (products.length === 0) throw new Error('Listado Cocheslot vacío');
      return products;
    }
    if (page === COCHESLOT_MAX_PAGES) throw new Error('Listado Cocheslot incompleto');
  }
  return products;
}

function cocheslotCandidates(html, query) {
  const urls = [];
  for (const hit of cocheslotListingHits(html)) {
    if (sameSku(hit.sku, query)) urls.push(hit.productUrl);
  }
  return [...new Set(urls)];
}

function parseCocheslotProduct(html, pageUrl) {
  const source = String(html || '');
  const h1 = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const sku = cocheslotReference(h1 ? h1[1] : '') || cocheslotReference(pageUrl);
  if (!sku) return null;
  const block = source.match(/class="product-prices js-product-prices"[\s\S]{0,1800}/i);
  const scope = block ? block[0] : '';
  const price = parseEuroAmount((scope.match(/class="product-price[^"]*"[^>]*content="([^"]+)"/i) || [])[1]);
  const regular = parseEuroAmount((scope.match(/class="regular-price[^"]*"[^>]*>([^<]+)/i) || [])[1]);
  const availability = scope.match(/class="([^"]*\bjs-product-availability\b[^"]*)"/i);
  const pathSlug = cocheslotPathSlug(String(pageUrl || '').split('?')[0]);
  const hit = {
    productUrl: String(pageUrl || '').split('?')[0],
    sku,
    name: cocheslotText(h1 ? h1[1] : ''),
    price,
    currency: 'EUR',
    inStock: !(availability && /product-unavailable|out-of-stock/i.test(availability[1])),
    categorySlugs: pathSlug ? [pathSlug] : [],
  };
  if (regular != null && price != null && regular > price) hit.regularPrice = regular;
  return hit;
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
  withListProducts(createShopAdapter({
    key: 'slotmania',
    origin: 'https://slotmania.es',
    searchUrl: (query) => `https://slotmania.es/es/busqueda?search_query=${encodeURIComponent(query)}`,
    parse: parseSlotmaniaProduct,
    candidates: slotmaniaCandidates,
  }), (fetchPage) => listSlotmaniaCatalog(fetchPage)),
  withListProducts(createShopAdapter({
    key: 'trofeslot',
    origin: 'https://trofeslot.com',
    lookupOnly: true,
    lookup: (fetchPage, query) => wooStoreLookup('https://trofeslot.com', fetchPage, query),
    searchUrl: (query) => `https://trofeslot.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`,
    parse: parseWooProduct,
    candidates: () => [],
  }), (fetchPage) => listWooCatalog('https://trofeslot.com', fetchPage)),
  withListProducts(createShopAdapter({
    key: 'speedslot',
    origin: 'https://www.speedslot.es',
    lookupOnly: true,
    lookup: (fetchPage, query) => wooStoreLookup('https://www.speedslot.es', fetchPage, query),
    searchUrl: (query) => `https://www.speedslot.es/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}`,
    parse: parseWooProduct,
    candidates: () => [],
  }), (fetchPage) => listWooCatalog('https://www.speedslot.es', fetchPage, { category: 344 })),
  withListProducts(createShopAdapter({
    key: 'clickslot',
    origin: 'https://clickslot.shop',
    lookupOnly: true,
    lookup: (fetchPage, query) => shopifyLookup('https://clickslot.shop', fetchPage, query),
    searchUrl: (query) => `https://clickslot.shop/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`,
    parse: parseShopifyProduct,
    candidates: () => [],
  }), (fetchPage) => listShopifyCollection('https://clickslot.shop', 'coches', fetchPage)),
  withListProducts(createShopAdapter({
    key: 'cocheslot',
    origin: 'https://www.cocheslot.net',
    searchUrl: (query) => `https://www.cocheslot.net/busqueda?controller=search&s=${encodeURIComponent(query)}`,
    parse: parseCocheslotProduct,
    candidates: cocheslotCandidates,
  }), (fetchPage) => listCocheslotCatalog(fetchPage)),
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
  slotmaniaListingHits,
  slotmaniaCarCategories,
  listSlotmaniaCatalog,
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
};
