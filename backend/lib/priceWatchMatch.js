const { isPublicOffer, publicOfferCutoff, normalizeCurrency, normalizePrice } = require('./shopOfferSync');

function priceCents(value) {
  const n = normalizePrice(value);
  if (n == null) return null;
  return Math.round(n * 100);
}

/**
 * Avisa la primera vez que una tienda en stock queda a o por debajo del tope,
 * y otra vez solo si esa tienda baja más el precio.
 */
function shouldNotifyWatch({
  inStock,
  price,
  currency,
  maxPrice,
  watchCurrency,
  lastNotifiedPrice,
}) {
  if (!inStock) return false;
  const priceC = priceCents(price);
  const maxC = priceCents(maxPrice);
  if (priceC == null || maxC == null) return false;
  if (normalizeCurrency(currency) !== normalizeCurrency(watchCurrency || 'EUR')) return false;
  if (priceC > maxC) return false;
  if (lastNotifiedPrice == null || lastNotifiedPrice === '') return true;
  const lastC = priceCents(lastNotifiedPrice);
  if (lastC == null) return true;
  return priceC < lastC;
}

function embedOne(value) {
  return Array.isArray(value) ? value[0] : value;
}

function latestNoticePrice(notices, watchId, shopId) {
  let latest = null;
  for (const row of notices || []) {
    if (row.watch_id !== watchId || row.shop_id !== shopId) continue;
    if (!latest || String(row.created_at || '') > String(latest.created_at || '')) latest = row;
  }
  return latest ? latest.price : null;
}

async function insertNotice(admin, { watch, offer, shopName, reference, modelName }) {
  const { error } = await admin.from('catalog_price_watch_notices').insert({
    user_id: watch.user_id,
    watch_id: watch.id,
    offer_id: offer.id,
    shop_id: offer.shop_id,
    catalog_item_id: offer.catalog_item_id,
    shop_name: shopName || 'Tienda',
    reference: reference || null,
    model_name: modelName || null,
    price: normalizePrice(offer.price),
    currency: normalizeCurrency(offer.currency),
    short_code: offer.short_code || null,
  });
  if (error) throw new Error(error.message);
}

/**
 * @returns {Promise<string[]>} ids de búsquedas avisadas
 */
async function matchOfferToWatches(admin, offer, meta = {}) {
  if (!offer?.in_stock || offer.price == null || !offer.id || !offer.shop_id || !offer.catalog_item_id) {
    return [];
  }
  const currency = normalizeCurrency(offer.currency);
  const price = normalizePrice(offer.price);
  if (price == null) return [];

  const { data: watches, error } = await admin
    .from('catalog_price_watches')
    .select('id, user_id, catalog_item_id, max_price, currency')
    .eq('catalog_item_id', offer.catalog_item_id)
    .eq('currency', currency)
    .gte('max_price', price);
  if (error) throw new Error(error.message);
  const list = watches || [];
  if (!list.length) return [];

  const { data: notices, error: noticeErr } = await admin
    .from('catalog_price_watch_notices')
    .select('watch_id, shop_id, price, created_at')
    .in('watch_id', list.map((watch) => watch.id))
    .eq('shop_id', offer.shop_id)
    .order('created_at', { ascending: false });
  if (noticeErr) throw new Error(noticeErr.message);

  const created = [];
  for (const watch of list) {
    const lastPrice = latestNoticePrice(notices, watch.id, offer.shop_id);
    if (!shouldNotifyWatch({
      inStock: true,
      price,
      currency,
      maxPrice: watch.max_price,
      watchCurrency: watch.currency,
      lastNotifiedPrice: lastPrice,
    })) continue;
    await insertNotice(admin, {
      watch,
      offer: { ...offer, price, currency },
      shopName: meta.shopName,
      reference: meta.reference,
      modelName: meta.modelName,
    });
    created.push(watch.id);
  }
  return created;
}

async function matchStoredOffer(admin, offerId) {
  const { data, error } = await admin
    .from('catalog_shop_offers')
    .select('id, shop_id, catalog_item_id, price, currency, in_stock, short_code, catalog_shops(name), slot_catalog_items(reference, model_name)')
    .eq('id', offerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];
  const shop = embedOne(data.catalog_shops);
  const item = embedOne(data.slot_catalog_items);
  return matchOfferToWatches(admin, data, {
    shopName: shop?.name,
    reference: item?.reference,
    modelName: item?.model_name,
  });
}

async function matchPublicOffersForWatch(admin, watch) {
  const currency = normalizeCurrency(watch.currency);
  const maxPrice = normalizePrice(watch.max_price);
  if (maxPrice == null) return { created: 0, matchedOfferIds: [] };

  const { data, error } = await admin
    .from('catalog_shop_offers')
    .select('id, shop_id, catalog_item_id, price, currency, in_stock, short_code, last_checked_at, catalog_shops!inner(name, active), slot_catalog_items(reference, model_name)')
    .eq('catalog_item_id', watch.catalog_item_id)
    .eq('in_stock', true)
    .eq('currency', currency)
    .lte('price', maxPrice)
    .gte('last_checked_at', publicOfferCutoff());
  if (error) throw new Error(error.message);

  const now = new Date();
  let created = 0;
  const matchedOfferIds = [];
  for (const row of data || []) {
    const shop = embedOne(row.catalog_shops);
    if (!isPublicOffer(row, shop, now)) continue;
    matchedOfferIds.push(row.id);
    const item = embedOne(row.slot_catalog_items);
    const ids = await matchOfferToWatches(admin, row, {
      shopName: shop?.name,
      reference: item?.reference,
      modelName: item?.model_name,
    });
    created += ids.length;
  }
  return { created, matchedOfferIds };
}

module.exports = {
  shouldNotifyWatch,
  matchOfferToWatches,
  matchStoredOffer,
  matchPublicOffersForWatch,
};
