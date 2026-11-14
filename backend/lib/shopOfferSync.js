const { createShortCode: defaultShortCode } = require('./shortCode');
const { normalizeCode, isSpareProduct } = require('./shopAdapters/productParse');

const STOCK_FRESH_MS = 8 * 24 * 60 * 60 * 1000;
const RECHECK_LIMIT = 40;
const DISCOVER_PER_SHOP = 20;
const FANOUT_CALLS = 24;

function isPublicOffer(offer, shop, now = new Date()) {
  if (!offer || !offer.in_stock) return false;
  if (!shop || shop.active === false) return false;
  if (!offer.last_checked_at) return false;
  const checked = new Date(offer.last_checked_at).getTime();
  if (Number.isNaN(checked)) return false;
  return now.getTime() - checked <= STOCK_FRESH_MS;
}

function publicOfferCutoff(now = new Date()) {
  return new Date(now.getTime() - STOCK_FRESH_MS).toISOString();
}

function normalizeCurrency(value, fallback = 'EUR') {
  const raw = String(value || fallback || 'EUR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : 'EUR';
}

function normalizePrice(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function normalizeProductUrl(url) {
  const raw = String(url || '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

/**
 * previous_price solo se guarda si queda por encima del precio actual:
 * la tarifa tachada de la tienda, o el último precio nuestro si ha bajado.
 * Una subida borra el tachado. Si el precio no cambia, se conserva el tachado vigente.
 */
function nextOfferPrices({ price, regularPrice, existingPrice, existingPrevious }) {
  const current = normalizePrice(price);
  const regular = normalizePrice(regularPrice);
  const stored = normalizePrice(existingPrice);
  const storedPrevious = normalizePrice(existingPrevious);
  let previous = null;
  if (current != null && regular != null && regular > current) {
    previous = regular;
  } else if (current != null && stored != null && current < stored) {
    previous = stored;
  } else if (current != null && stored != null && current > stored) {
    previous = null;
  } else if (current != null && storedPrevious != null && storedPrevious > current) {
    previous = storedPrevious;
  }
  return { price: current, previous_price: previous };
}

function offerPatchFromHit(hit, shop, nowIso, previousUrl, existing) {
  const productUrl = normalizeProductUrl(hit.productUrl) || previousUrl;
  const prices = nextOfferPrices({
    price: hit.price,
    regularPrice: hit.regularPrice,
    existingPrice: existing?.price,
    existingPrevious: existing?.previous_price,
  });
  return {
    product_url: productUrl,
    price: prices.price,
    previous_price: prices.previous_price,
    currency: normalizeCurrency(hit.currency, shop?.currency),
    in_stock: Boolean(hit.inStock),
    last_checked_at: nowIso,
    last_attempt_at: nowIso,
    last_check_error: null,
    updated_at: nowIso,
  };
}

function skuCode(raw) {
  const text = String(raw || '').replace(/^referencia\s*:\s*/i, '');
  const key = normalizeCode(text);
  return key.length >= 4 ? key : '';
}

function emptyOfferSummary() {
  return {
    shops: 0,
    skipped_shops: 0,
    skipped: [],
    checked: 0,
    discovered: 0,
    out_of_stock: 0,
    errors: 0,
    created: [],
    withdrawn: [],
  };
}

function catalogIdentity(row) {
  const nested = row && row.slot_catalog_items;
  const item = Array.isArray(nested) ? nested[0] : nested;
  return {
    catalog_item_id: (row && (row.catalog_item_id || row.id)) || null,
    reference: (row && row.reference) || (item && item.reference) || null,
    model_name: (row && row.model_name) || (item && item.model_name) || null,
    manufacturer: (row && (row.manufacturer || row.brand)) || (item && item.manufacturer) || null,
  };
}

function pushCatalogEvent(list, shop, row, extra) {
  list.push({
    shop: shop?.name || null,
    adapter_key: shop?.adapter_key || null,
    ...catalogIdentity(row),
    ...extra,
  });
}

function skipReason(shop) {
  const key = String(shop?.adapter_key || '').trim();
  if (!key) return 'La tienda no tiene adaptador';
  return `No hay adaptador registrado para «${key}»`;
}

function indexCatalog(items) {
  const byCode = new Map();
  const put = (key, item) => {
    if (key && !byCode.has(key)) byCode.set(key, item);
  };
  const putCode = (raw, item) => {
    const key = normalizeCode(raw);
    put(key, item);
    const sideways = key.match(/^RCSW0*(\d+)$/);
    if (sideways) put(`RCSW${Number(sideways[1])}`, item);
  };
  for (const item of items || []) putCode(item.reference, item);
  for (const item of items || []) {
    for (const alias of item.aliases || []) putCode(alias, item);
  }
  return byCode;
}

function catalogItemForSku(byCode, sku) {
  const key = skuCode(sku);
  if (!key) return null;
  if (byCode.has(key)) return byCode.get(key);
  const sideways = key.match(/^RCSW0*(\d+)$/);
  if (!sideways) return null;
  return byCode.get(`RCSW${Number(sideways[1])}`) || null;
}

async function syncShopListing({ shop, adapter, io, nowIso, newShortCode, summary, onInStock }) {
  let products;
  try {
    products = await adapter.listProducts();
  } catch {
    summary.errors += 1;
    return;
  }
  if (!Array.isArray(products) || products.length === 0 || !products.some((hit) => skuCode(hit && hit.sku))) {
    summary.errors += 1;
    return;
  }

  let catalogRows;
  try {
    catalogRows = await io.listCatalogReferences();
  } catch {
    summary.errors += 1;
    return;
  }
  const byCode = indexCatalog(catalogRows);
  const seen = new Set();
  for (const hit of products) {
    if (isSpareProduct(hit)) continue;
    const item = catalogItemForSku(byCode, hit.sku);
    if (!item || seen.has(item.id) || !normalizeProductUrl(hit.productUrl)) continue;
    seen.add(item.id);
    try {
      const existing = await io.findOffer(shop.id, item.id);
      const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl, existing);
      if (existing) {
        await io.updateOffer(existing.id, patch);
        if (existing.in_stock !== false && !patch.in_stock) {
          pushCatalogEvent(summary.withdrawn, shop, item, { product_url: patch.product_url });
        }
      } else {
        await io.insertOffer({
          shop_id: shop.id,
          catalog_item_id: item.id,
          ...patch,
          short_code: newShortCode(),
        });
        pushCatalogEvent(summary.created, shop, item, {
          product_url: patch.product_url,
          in_stock: Boolean(patch.in_stock),
        });
      }
      if (patch.in_stock) {
        summary.discovered += 1;
        if (onInStock) onInStock(item);
      } else summary.out_of_stock += 1;
    } catch {
      summary.errors += 1;
    }
  }

  let offers;
  try {
    offers = await io.listShopOffers(shop.id);
  } catch {
    summary.errors += 1;
    return;
  }
  for (const offer of offers) {
    if (seen.has(offer.catalog_item_id)) continue;
    try {
      await io.updateOffer(offer.id, {
        in_stock: false,
        last_checked_at: nowIso,
        last_attempt_at: nowIso,
        last_check_error: null,
        updated_at: nowIso,
      });
      if (offer.in_stock !== false) {
        summary.out_of_stock += 1;
        pushCatalogEvent(summary.withdrawn, shop, offer, { product_url: offer.product_url });
      }
    } catch {
      summary.errors += 1;
    }
  }
}

/**
 * Lote del cron. 40 rechecks, primero las que están en stock, y 20 búsquedas nuevas por tienda.
 * Una tienda con listProducts refresca su listado entero y no entra en ese cupo.
 * Cada referencia encontrada en stock se busca también en las demás tiendas, con un tope de peticiones.
 * Un fallo de red no pone in_stock en true ni mueve last_checked_at.
 * Si el listado WooCommerce falla a medias, no se marcan como agotadas las ofertas que faltan.
 */
async function runShopOfferBatch({
  io,
  getAdapter,
  now = new Date(),
  recheckLimit = RECHECK_LIMIT,
  discoverPerShop = DISCOVER_PER_SHOP,
  fanoutCalls = FANOUT_CALLS,
  pauseMs = 0,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newShortCode = defaultShortCode,
}) {
  const summary = emptyOfferSummary();

  const shops = await io.listActiveShops();
  const runnable = [];
  for (const shop of shops) {
    if (getAdapter(shop.adapter_key)) runnable.push(shop);
    else {
      summary.skipped.push({
        name: shop.name || null,
        adapter_key: shop.adapter_key || null,
        reason: skipReason(shop),
      });
    }
  }
  summary.skipped_shops = summary.skipped.length;
  summary.shops = runnable.length;
  if (runnable.length === 0) return summary;

  const searchShops = [];
  const listingShops = [];
  for (const shop of runnable) {
    const adapter = getAdapter(shop.adapter_key);
    if (adapter && typeof adapter.listProducts === 'function') listingShops.push(shop);
    else searchShops.push(shop);
  }

  const stocked = [];
  const shopById = new Map(searchShops.map((shop) => [shop.id, shop]));
  let offers = [];
  if (searchShops.length) {
    try {
      offers = await io.listOffersToRecheck([...shopById.keys()], recheckLimit);
    } catch {
      summary.errors += 1;
      offers = [];
    }
  }
  const nowIso = now.toISOString();

  for (const offer of offers) {
    const shop = shopById.get(offer.shop_id);
    const adapter = shop ? getAdapter(shop.adapter_key) : null;
    if (!shop || !adapter) continue;
    try {
      const hit = await adapter.checkProduct(offer.product_url);
      if (!hit) {
        await io.updateOffer(offer.id, {
          in_stock: false,
          last_checked_at: nowIso,
          last_attempt_at: nowIso,
          last_check_error: null,
          updated_at: nowIso,
        });
        summary.out_of_stock += 1;
        if (offer.in_stock !== false) {
          pushCatalogEvent(summary.withdrawn, shop, offer, { product_url: offer.product_url });
        }
      } else {
        const patch = offerPatchFromHit(hit, shop, nowIso, offer.product_url, offer);
        if (!patch.product_url) {
          throw new Error('URL de producto inválida');
        }
        await io.updateOffer(offer.id, patch);
        if (patch.in_stock) summary.checked += 1;
        else {
          summary.out_of_stock += 1;
          if (offer.in_stock !== false) {
            pushCatalogEvent(summary.withdrawn, shop, offer, { product_url: offer.product_url });
          }
        }
      }
    } catch (err) {
      summary.errors += 1;
      try {
        await io.updateOffer(offer.id, {
          last_attempt_at: nowIso,
          last_check_error: String(err.message || err).slice(0, 500),
          updated_at: nowIso,
        });
      } catch {
        /* el siguiente lote lo reintenta */
      }
    }
    if (pauseMs > 0) await sleep(pauseMs);
  }

  for (const shop of listingShops) {
    await syncShopListing({
      shop,
      adapter: getAdapter(shop.adapter_key),
      io,
      nowIso,
      newShortCode,
      summary,
      onInStock: (item) => stocked.push({ shopId: shop.id, item }),
    });
  }

  for (const shop of searchShops) {
    const adapter = getAdapter(shop.adapter_key);
    const items = await io.listCatalogItems(shop.discover_after_id || null, discoverPerShop);
    for (const item of items) {
      try {
        const hit = await adapter.findByReference({
          reference: item.reference,
          ean: item.ean ?? null,
          brand: item.brand ?? null,
        });
        if (hit && normalizeProductUrl(hit.productUrl)) {
          const existing = await io.findOffer(shop.id, item.id);
          const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl, existing);
          if (existing) {
            await io.updateOffer(existing.id, patch);
            if (existing.in_stock !== false && !patch.in_stock) {
              pushCatalogEvent(summary.withdrawn, shop, item, { product_url: patch.product_url });
            }
          } else {
            await io.insertOffer({
              shop_id: shop.id,
              catalog_item_id: item.id,
              ...patch,
              short_code: newShortCode(),
            });
            pushCatalogEvent(summary.created, shop, item, {
              product_url: patch.product_url,
              in_stock: Boolean(patch.in_stock),
            });
          }
          summary.discovered += 1;
          if (patch.in_stock) stocked.push({ shopId: shop.id, item });
        }
      } catch (err) {
        summary.errors += 1;
      }
      if (pauseMs > 0) await sleep(pauseMs);
    }
    const nextCursor = items.length < discoverPerShop
      ? null
      : items[items.length - 1].id;
    await io.setDiscoverCursor(shop.id, nextCursor);
  }

  const seenFanout = new Set();
  let calls = 0;
  for (const found of stocked) {
    if (calls >= fanoutCalls) break;
    for (const shop of searchShops) {
      if (calls >= fanoutCalls) break;
      if (shop.id === found.shopId) continue;
      const key = `${shop.id}:${found.item.id}`;
      if (seenFanout.has(key)) continue;
      seenFanout.add(key);
      try {
        const existing = await io.findOffer(shop.id, found.item.id);
        if (existing) continue;
        calls += 1;
        const adapter = getAdapter(shop.adapter_key);
        const hit = await adapter.findByReference({
          reference: found.item.reference,
          ean: found.item.ean ?? null,
          brand: found.item.brand ?? found.item.manufacturer ?? null,
        });
        if (hit && normalizeProductUrl(hit.productUrl)) {
          const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl, null);
          await io.insertOffer({
            shop_id: shop.id,
            catalog_item_id: found.item.id,
            ...patch,
            short_code: newShortCode(),
          });
          pushCatalogEvent(summary.created, shop, found.item, {
            product_url: patch.product_url,
            in_stock: Boolean(patch.in_stock),
          });
          summary.discovered += 1;
        }
      } catch {
        summary.errors += 1;
      }
      if (pauseMs > 0) await sleep(pauseMs);
    }
  }

  return summary;
}

/**
 * Búsqueda de una sola referencia, para probar una tienda sin recorrer el catálogo.
 * No mueve el cursor de descubrimiento.
 */
async function runShopOfferLookup({
  io,
  getAdapter,
  reference,
  now = new Date(),
  pauseMs = 0,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newShortCode = defaultShortCode,
}) {
  const item = await io.findCatalogItemByReference(reference);
  const summary = {
    found: Boolean(item),
    reference: item?.reference || String(reference || ''),
    catalog_item_id: item?.id || null,
    shops: 0,
    matched: 0,
    out_of_stock: 0,
    skipped_shops: 0,
    errors: 0,
    discontinued: Boolean(item?.discontinued),
  };
  if (!item || item.discontinued) return summary;

  const shops = await io.listActiveShops();
  const nowIso = now.toISOString();
  for (const shop of shops) {
    const adapter = getAdapter(shop.adapter_key);
    if (!adapter) {
      summary.skipped_shops += 1;
      continue;
    }
    summary.shops += 1;
    try {
      const hit = await adapter.findByReference({
        reference: item.reference,
        ean: item.ean ?? null,
        brand: item.brand ?? null,
      });
      if (!hit || !normalizeProductUrl(hit.productUrl)) continue;
      const existing = await io.findOffer(shop.id, item.id);
      const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl, existing);
      if (existing) {
        await io.updateOffer(existing.id, patch);
      } else {
        await io.insertOffer({
          shop_id: shop.id,
          catalog_item_id: item.id,
          ...patch,
          short_code: newShortCode(),
        });
      }
      if (patch.in_stock) summary.matched += 1;
      else summary.out_of_stock += 1;
    } catch {
      summary.errors += 1;
    }
    if (pauseMs > 0) await sleep(pauseMs);
  }
  return summary;
}

function createSupabaseShopOfferIo(admin, { createShortCode } = {}) {
  async function brandNames(ids) {
    const brandIds = [...new Set((ids || []).filter(Boolean))];
    const brands = new Map();
    for (let index = 0; index < brandIds.length; index += 200) {
      const chunk = brandIds.slice(index, index + 200);
      const { data, error } = await admin
        .from('slot_catalog_brands')
        .select('id, name')
        .in('id', chunk);
      if (error) throw new Error(error.message);
      for (const brand of data || []) brands.set(brand.id, brand.name);
    }
    return brands;
  }

  function itemOf(row) {
    const nested = row && row.slot_catalog_items;
    return Array.isArray(nested) ? nested[0] : nested;
  }

  return {
    async listActiveShops() {
      const { data, error } = await admin
        .from('catalog_shops')
        .select('id, name, country_code, adapter_key, currency, active, discover_after_id')
        .eq('active', true);
      if (error) throw new Error(error.message);
      return data || [];
    },

    async listOffersToRecheck(shopIds, limit) {
      if (!shopIds.length) return [];
      const { data, error } = await admin
        .from('catalog_shop_offers')
        .select('id, shop_id, catalog_item_id, product_url, price, previous_price, currency, in_stock, slot_catalog_items!inner(discontinued, reference, model_name, manufacturer_id)')
        .in('shop_id', shopIds)
        .eq('slot_catalog_items.discontinued', false)
        .order('in_stock', { ascending: false })
        .order('last_attempt_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      const brands = await brandNames((data || []).map((row) => itemOf(row)?.manufacturer_id));
      return (data || []).map((row) => {
        const item = itemOf(row);
        if (!item) return row;
        return {
          ...row,
          slot_catalog_items: {
            ...item,
            manufacturer: brands.get(item.manufacturer_id) || null,
          },
        };
      });
    },

    async updateOffer(id, patch) {
      const { error } = await admin.from('catalog_shop_offers').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async findOffer(shopId, catalogItemId) {
      const { data, error } = await admin
        .from('catalog_shop_offers')
        .select('id, short_code, price, previous_price, in_stock')
        .eq('shop_id', shopId)
        .eq('catalog_item_id', catalogItemId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async insertOffer(row) {
      const shortFromCaller = row.short_code;
      let lastError = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const short_code = attempt === 0 && shortFromCaller
          ? shortFromCaller
          : (createShortCode ? createShortCode() : shortFromCaller);
        const { error } = await admin.from('catalog_shop_offers').insert({ ...row, short_code });
        if (!error) return short_code;
        lastError = error;
        const msg = `${error.message || ''} ${error.details || ''}`;
        const shortCollision = error.code === '23505' && /short_code/i.test(msg);
        if (!shortCollision) throw new Error(error.message);
      }
      throw new Error(lastError?.message || 'No se pudo generar un código corto');
    },

    async listCatalogItems(afterId, limit) {
      let query = admin
        .from('slot_catalog_items')
        .select('id, reference, ean, manufacturer_id')
        .eq('discontinued', false)
        .order('id', { ascending: true })
        .limit(limit);
      if (afterId) query = query.gt('id', afterId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = data || [];
      const brandIds = [...new Set(rows.map((row) => row.manufacturer_id).filter(Boolean))];
      const brands = new Map();
      if (brandIds.length > 0) {
        const { data: brandRows, error: brandError } = await admin
          .from('slot_catalog_brands')
          .select('id, name')
          .in('id', brandIds);
        if (brandError) throw new Error(brandError.message);
        for (const brand of brandRows || []) brands.set(brand.id, brand.name);
      }
      return rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        ean: row.ean ?? null,
        brand: brands.get(row.manufacturer_id) || null,
      }));
    },

    async findCatalogItemByReference(reference) {
      const wanted = String(reference || '').trim();
      if (!wanted) return null;
      const { data, error } = await admin
        .from('slot_catalog_items')
        .select('id, reference, ean, manufacturer_id, discontinued')
        .ilike('reference', wanted)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      let brand = null;
      if (data.manufacturer_id) {
        const { data: brandRow, error: brandError } = await admin
          .from('slot_catalog_brands')
          .select('name')
          .eq('id', data.manufacturer_id)
          .maybeSingle();
        if (brandError) throw new Error(brandError.message);
        brand = brandRow?.name || null;
      }
      return {
        id: data.id,
        reference: data.reference,
        ean: data.ean ?? null,
        brand,
        discontinued: Boolean(data.discontinued),
      };
    },

    async listCatalogReferences() {
      const rows = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await admin
          .from('slot_catalog_items')
          .select('id, reference, model_name, manufacturer_id')
          .eq('discontinued', false)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      const brands = await brandNames(rows.map((row) => row.manufacturer_id));
      const aliasByItem = new Map();
      const aliasPageSize = 1000;
      for (let from = 0; ; from += aliasPageSize) {
        const { data: aliasRows, error: aliasError } = await admin
          .from('slot_catalog_item_aliases')
          .select('id, catalog_item_id, alias_reference')
          .order('id', { ascending: true })
          .range(from, from + aliasPageSize - 1);
        if (aliasError) throw new Error(aliasError.message);
        for (const alias of aliasRows || []) {
          const list = aliasByItem.get(alias.catalog_item_id) || [];
          list.push(alias.alias_reference);
          aliasByItem.set(alias.catalog_item_id, list);
        }
        if (!aliasRows || aliasRows.length < aliasPageSize) break;
      }
      return rows.map((row) => ({
        ...row,
        manufacturer: brands.get(row.manufacturer_id) || null,
        aliases: aliasByItem.get(row.id) || [],
      }));
    },

    async listShopOffers(shopId) {
      const rows = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await admin
          .from('catalog_shop_offers')
          .select('id, catalog_item_id, product_url, price, previous_price, in_stock, slot_catalog_items!inner(reference, model_name, manufacturer_id, discontinued)')
          .eq('shop_id', shopId)
          .eq('slot_catalog_items.discontinued', false)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      const brands = await brandNames(rows.map((row) => itemOf(row)?.manufacturer_id));
      return rows.map((row) => {
        const item = itemOf(row);
        if (!item) return row;
        return {
          ...row,
          slot_catalog_items: {
            ...item,
            manufacturer: brands.get(item.manufacturer_id) || null,
          },
        };
      });
    },

    async setDiscoverCursor(shopId, discoverAfterId) {
      const { error } = await admin
        .from('catalog_shops')
        .update({
          discover_after_id: discoverAfterId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopId);
      if (error) throw new Error(error.message);
    },
  };
}

module.exports = {
  STOCK_FRESH_MS,
  RECHECK_LIMIT,
  DISCOVER_PER_SHOP,
  FANOUT_CALLS,
  isPublicOffer,
  publicOfferCutoff,
  normalizeCurrency,
  normalizePrice,
  normalizeProductUrl,
  nextOfferPrices,
  indexCatalog,
  runShopOfferBatch,
  runShopOfferLookup,
  createSupabaseShopOfferIo,
  emptyOfferSummary,
};
