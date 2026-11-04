function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** RCSW82 y RCSW0082 son la misma referencia Sideways. El resto se compara tal cual. */
function sameSku(left, right) {
  const a = normalizeCode(left);
  const b = normalizeCode(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const fold = (code) => {
    const match = code.match(/^RCSW0*(\d+)$/);
    return match ? `RCSW${Number(match[1])}` : null;
  };
  const foldedA = fold(a);
  const foldedB = fold(b);
  return Boolean(foldedA && foldedB && foldedA === foldedB);
}

function parseEuroAmount(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return Math.round(raw * 100) / 100;
  }
  let text = String(raw).replace(/[^\d,.-]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function absoluteUrl(href, origin) {
  try {
    const url = new URL(href, origin);
    const base = new URL(origin);
    if (url.origin !== base.origin) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function walkJsonLd(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item) => walkJsonLd(item, visit));
    return;
  }
  visit(node);
  if (node['@graph']) walkJsonLd(node['@graph'], visit);
}

function jsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      /* un bloque mal formado no invalida el resto */
    }
  }
  return blocks;
}

function itemListUrls(html, origin) {
  const urls = [];
  for (const block of jsonLdBlocks(html)) {
    walkJsonLd(block, (node) => {
      if (node['@type'] !== 'ItemList' || !Array.isArray(node.itemListElement)) return;
      for (const item of node.itemListElement) {
        const href = typeof item === 'string' ? item : (item && (item.url || item.item));
        const url = typeof href === 'string' ? absoluteUrl(href, origin) : null;
        if (url) urls.push(url);
      }
    });
  }
  return [...new Set(urls)];
}

function productListCards(html) {
  const block = html.match(/(?:id|class)="product_list"[\s\S]*?<\/ul>/i);
  if (!block) return [];
  return [...block[0].matchAll(/<li[^>]*ajax_block_product[\s\S]*?<\/li>/gi)].map((match) => match[0]);
}

function cardProductUrl(card, origin) {
  const href = card.match(/href="([^"]+\/\d+-[^"]+\.html)"/i);
  return href ? absoluteUrl(href[1], origin) : null;
}

function textHasCode(text, query) {
  const code = normalizeCode(query);
  if (!code) return false;
  if (normalizeCode(text).includes(code)) return true;
  const tokens = String(text).match(/[A-Za-z]{2,}[\s-]*\d{2,}/g) || [];
  return tokens.some((token) => sameSku(token, query));
}

function productAnchors(html, origin) {
  const anchors = [];
  const pattern = /<a\b([^>]*?)href="([^"]+)"([^>]*)>/gi;
  for (const match of html.matchAll(pattern)) {
    const url = absoluteUrl(match[2], origin);
    if (!url || !/\/\d+-/.test(url) || !/\.html$/i.test(url)) continue;
    anchors.push({ url, blob: `${match[1]} ${url} ${match[3]}` });
  }
  return anchors;
}

function anchorsWithCode(html, origin, query) {
  const urls = [];
  const seen = new Set();
  for (const anchor of productAnchors(html, origin)) {
    if (seen.has(anchor.url) || !textHasCode(anchor.blob, query)) continue;
    seen.add(anchor.url);
    urls.push(anchor.url);
  }
  return urls;
}

function offerPrice(offer) {
  if (!offer) return { price: null, currency: null };
  const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [];
  const sale = specs.find((spec) => spec && spec.price != null && !/ListPrice/i.test(String(spec.priceType || '')));
  if (offer.price != null && offer.price !== '') {
    return {
      price: parseEuroAmount(offer.price),
      currency: offer.priceCurrency || (sale && sale.priceCurrency) || null,
    };
  }
  if (!sale) return { price: null, currency: null };
  return { price: parseEuroAmount(sale.price), currency: sale.priceCurrency || null };
}

/** WooCommerce: el párrafo de stock manda si dice cuántas unidades quedan. */
function parseWooProduct(html, pageUrl) {
  const hit = parseJsonLdProduct(html, pageUrl);
  if (!hit) return null;
  const stock = html.match(/<p[^>]*class="[^"]*\bstock\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  if (!stock) return hit;
  const text = stock[1].replace(/<[^>]+>/g, ' ');
  const qty = text.match(/(\d+)\s*disponibles/i);
  if (/out-of-stock/i.test(stock[0]) || (qty && Number(qty[1]) === 0)) hit.inStock = false;
  else if ((qty && Number(qty[1]) > 0) || /in-stock/i.test(stock[0])) hit.inStock = true;
  return hit;
}

function parseJsonLdProduct(html, pageUrl) {
  let found = null;
  for (const block of jsonLdBlocks(html)) {
    walkJsonLd(block, (node) => {
      if (found) return;
      const type = node['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes('Product')) return;
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const priced = offerPrice(offer);
      const availability = String((offer && offer.availability) || '');
      const offerUrl = offer && typeof offer.url === 'string' ? offer.url : node.url;
      found = {
        productUrl: absoluteUrl(offerUrl || pageUrl, pageUrl) || pageUrl,
        price: priced.price,
        currency: String(priced.currency || (offer && offer.priceCurrency) || 'EUR').toUpperCase(),
        inStock: /\/(?:InStock|LimitedAvailability)$/i.test(availability),
        sku: node.sku || null,
        gtin: node.gtin13 || node.gtin || null,
      };
    });
  }
  return found;
}

function parseEvotecProduct(html, pageUrl) {
  const reference = html.match(/var productReference='([^']*)'/);
  if (!reference) return null;
  const price = html.match(/id="our_price_display"[^>]*>\s*([^<]+)/i);
  const orderable = html.match(/var productAvailableForOrder='([^']*)'/);
  const button = html.match(/<p[^>]*id="add_to_cart"[^>]*>/i);
  const buttonHidden = Boolean(button && /display\s*:\s*none/i.test(button[0]));
  const availability = html.match(/<p[^>]*id="availability_statut"[^>]*>/i);
  const availabilityShown = Boolean(availability && !/display\s*:\s*none/i.test(availability[0]));
  return {
    productUrl: pageUrl,
    price: parseEuroAmount(price && price[1]),
    currency: 'EUR',
    inStock: orderable?.[1] === '1' && Boolean(button) && !buttonHidden && !availabilityShown,
    sku: reference[1],
    gtin: null,
  };
}

function parseDataProduct(html, pageUrl) {
  const attr = html.match(/data-product="([^"]+)"/);
  if (!attr) return null;
  let product;
  try {
    product = JSON.parse(decodeHtml(attr[1]));
  } catch {
    return null;
  }
  const quantity = Number(product.quantity);
  return {
    productUrl: pageUrl,
    price: parseEuroAmount(product.price_amount),
    currency: 'EUR',
    inStock: Number(product.available_for_order) === 1 && Number.isFinite(quantity) && quantity > 0,
    sku: product.reference || null,
    gtin: product.ean13 || null,
  };
}

function searchQueries(reference, ean) {
  const queries = [];
  const add = (value) => {
    const text = String(value || '').trim();
    if (text.length < 4) return;
    if (queries.some((query) => query.toUpperCase() === text.toUpperCase())) return;
    queries.push(text);
  };
  add(reference);
  const sideways = normalizeCode(reference).match(/^RCSW0*(\d+)$/);
  if (sideways) add(`RCSW${sideways[1].padStart(4, '0')}`);
  add(ean);
  return queries;
}

module.exports = {
  normalizeCode,
  sameSku,
  parseEuroAmount,
  absoluteUrl,
  itemListUrls,
  productListCards,
  cardProductUrl,
  textHasCode,
  urlsContainingCode: anchorsWithCode,
  anchorsWithCode,
  productAnchors,
  parseJsonLdProduct,
  parseWooProduct,
  parseEvotecProduct,
  parseDataProduct,
  searchQueries,
};
