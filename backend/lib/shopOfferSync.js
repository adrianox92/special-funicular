const { createShortCode: defaultShortCode } = require('./shortCode');

const STOCK_FRESH_MS = 8 * 24 * 60 * 60 * 1000;
const RECHECK_LIMIT = 40;
const DISCOVER_PER_SHOP = 20;

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

function offerPatchFromHit(hit, shop, nowIso, previousUrl) {
  const productUrl = normalizeProductUrl(hit.productUrl) || previousUrl;
  return {
    product_url: productUrl,
    price: normalizePrice(hit.price),
    currency: normalizeCurrency(hit.currency, shop?.currency),
    in_stock: Boolean(hit.inStock),
    last_checked_at: nowIso,
    last_attempt_at: nowIso,
    last_check_error: null,
    updated_at: nowIso,
  };
}

/**
 * Lote del cron. 40 rechecks de las ofertas más antiguas y 20 búsquedas nuevas por tienda.
 * Un fallo de red no pone in_stock en true ni mueve last_checked_at.
 */
async function runShopOfferBatch({
  io,
  getAdapter,
  now = new Date(),
  recheckLimit = RECHECK_LIMIT,
  discoverPerShop = DISCOVER_PER_SHOP,
  pauseMs = 0,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newShortCode = defaultShortCode,
}) {
  const summary = {
    shops: 0,
    skipped_shops: 0,
    checked: 0,
    discovered: 0,
    out_of_stock: 0,
    errors: 0,
  };

  const shops = await io.listActiveShops();
  const runnable = [];
  for (const shop of shops) {
    if (getAdapter(shop.adapter_key)) runnable.push(shop);
    else summary.skipped_shops += 1;
  }
  summary.shops = runnable.length;
  if (runnable.length === 0) return summary;

  const shopById = new Map(runnable.map((shop) => [shop.id, shop]));
  const offers = await io.listOffersToRecheck([...shopById.keys()], recheckLimit);
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
      } else {
        const patch = offerPatchFromHit(hit, shop, nowIso, offer.product_url);
        if (!patch.product_url) {
          throw new Error('URL de producto inválida');
        }
        await io.updateOffer(offer.id, patch);
        if (patch.in_stock) summary.checked += 1;
        else summary.out_of_stock += 1;
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

  for (const shop of runnable) {
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
          const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl);
          const existing = await io.findOffer(shop.id, item.id);
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
          summary.discovered += 1;
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
      const patch = offerPatchFromHit(hit, shop, nowIso, hit.productUrl);
      const existing = await io.findOffer(shop.id, item.id);
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
        .select('id, shop_id, catalog_item_id, product_url, price, currency, in_stock, slot_catalog_items!inner(discontinued)')
        .in('shop_id', shopIds)
        .eq('slot_catalog_items.discontinued', false)
        .order('last_attempt_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },

    async updateOffer(id, patch) {
      const { error } = await admin.from('catalog_shop_offers').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async findOffer(shopId, catalogItemId) {
      const { data, error } = await admin
        .from('catalog_shop_offers')
        .select('id, short_code')
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
  isPublicOffer,
  publicOfferCutoff,
  normalizeCurrency,
  normalizePrice,
  normalizeProductUrl,
  runShopOfferBatch,
  runShopOfferLookup,
  createSupabaseShopOfferIo,
};
