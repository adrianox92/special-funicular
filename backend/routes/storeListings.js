/**
 * Ofertas de tienda en la ficha pública y alta admin.
 *
 * Públicas:
 *   GET /catalog/:catalogItemId — ofertas en stock (últimos 8 días)
 *   GET /public/policies/:slug
 *
 * Admin:
 *   GET/POST /admin/shops
 *   PUT  /admin/shops/:id
 *   GET/POST /admin/offers
 *   PATCH /admin/offers/:id
 *   GET  /admin/catalog-matches
 *   GET  /admin/clicks
 *   GET/PUT /admin/policies
 *
 * El redirect con clic vive en GET /api/go/:code.
 */

const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { validateShopInput, validateManualOffer, validateOfferPatch } = require('../lib/shopInput');
const { isPublicOffer, publicOfferCutoff, nextOfferPrices } = require('../lib/shopOfferSync');
const { createShortCode } = require('../lib/shortCode');

const router = express.Router();

function isUuid(id) {
  return (
    typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

function requireAdminDb(res) {
  const db = getServiceClient();
  if (!db) {
    res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.',
    });
    return null;
  }
  return db;
}

function adminGuard(req, res, next) {
  if (!assertLicenseAdmin(req, res)) return;
  next();
}

function shopFromEmbed(row) {
  const shop = Array.isArray(row?.catalog_shops) ? row.catalog_shops[0] : row?.catalog_shops;
  return shop || null;
}

function toPublicOffer(row) {
  const shop = shopFromEmbed(row);
  const price = row.price == null ? null : Number(row.price);
  const previous = row.previous_price == null ? null : Number(row.previous_price);
  return {
    id: row.id,
    short_code: row.short_code,
    price: row.price,
    previous_price: previous != null && price != null && previous > price ? row.previous_price : null,
    currency: row.currency,
    shop_name: shop?.name ?? null,
    country_code: shop?.country_code ?? null,
    logo_url: shop?.logo_url ?? null,
  };
}

router.get('/catalog/:catalogItemId', async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    if (!isUuid(catalogItemId)) {
      return res.status(400).json({ error: 'ID de ítem inválido' });
    }
    const db = requireAdminDb(res);
    if (!db) return;

    const { data, error } = await db
      .from('catalog_shop_offers')
      .select('id, price, previous_price, currency, short_code, in_stock, last_checked_at, catalog_shops!inner(name, country_code, logo_url, active)')
      .eq('catalog_item_id', catalogItemId)
      .eq('in_stock', true)
      .gte('last_checked_at', publicOfferCutoff())
      .eq('catalog_shops.active', true);

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    const offers = (data || [])
      .filter((row) => isPublicOffer(row, shopFromEmbed(row), now))
      .map(toPublicOffer);
    res.json(offers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/shops', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const { data, error } = await db
      .from('catalog_shops')
      .select('id, name, country_code, logo_url, site_url, adapter_key, currency, active, created_at, updated_at')
      .order('country_code', { ascending: true })
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ shops: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/admin/shops', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const parsed = validateShopInput(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });

    const now = new Date().toISOString();
    const { data, error } = await db
      .from('catalog_shops')
      .insert({ ...parsed.value, created_at: now, updated_at: now })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/admin/shops/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const parsed = validateShopInput(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });

    const { data, error } = await db
      .from('catalog_shops')
      .update({ ...parsed.value, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function offerAdminRow(row) {
  const item = Array.isArray(row.slot_catalog_items) ? row.slot_catalog_items[0] : row.slot_catalog_items;
  return {
    id: row.id,
    catalog_item_id: row.catalog_item_id,
    reference: item?.reference ?? null,
    model_name: item?.model_name ?? null,
    manufacturer: row.manufacturer ?? item?.manufacturer ?? null,
    price: row.price,
    previous_price: row.previous_price,
    currency: row.currency,
    in_stock: row.in_stock,
    product_url: row.product_url,
    short_code: row.short_code,
    updated_at: row.updated_at,
  };
}

async function brandNameMap(db, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const brands = new Map();
  if (unique.length === 0) return brands;
  const { data, error } = await db.from('slot_catalog_brands').select('id, name').in('id', unique);
  if (error) throw new Error(error.message);
  for (const brand of data || []) brands.set(brand.id, brand.name);
  return brands;
}

function sameReference(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

async function findCatalogMatches(db, reference) {
  const needle = String(reference || '').trim();
  if (needle.length < 2 || needle.length > 80) return [];

  const { data: items, error } = await db
    .from('slot_catalog_items')
    .select('id, reference, model_name, discontinued, manufacturer_id')
    .ilike('reference', needle)
    .eq('discontinued', false)
    .limit(20);
  if (error) throw new Error(error.message);

  const { data: aliasRows, error: aliasError } = await db
    .from('slot_catalog_item_aliases')
    .select('alias_reference, slot_catalog_items!inner(id, reference, model_name, discontinued, manufacturer_id)')
    .ilike('alias_reference', needle)
    .limit(20);
  if (aliasError) throw new Error(aliasError.message);

  const byId = new Map();
  for (const item of items || []) {
    if (!sameReference(item.reference, needle) || item.discontinued) continue;
    byId.set(item.id, {
      id: item.id,
      reference: item.reference,
      model_name: item.model_name,
      manufacturer_id: item.manufacturer_id,
      matched_via: 'reference',
      alias_reference: null,
    });
  }
  for (const row of aliasRows || []) {
    if (!sameReference(row.alias_reference, needle)) continue;
    const item = Array.isArray(row.slot_catalog_items) ? row.slot_catalog_items[0] : row.slot_catalog_items;
    if (!item || item.discontinued || byId.has(item.id)) continue;
    byId.set(item.id, {
      id: item.id,
      reference: item.reference,
      model_name: item.model_name,
      manufacturer_id: item.manufacturer_id,
      matched_via: 'alias',
      alias_reference: row.alias_reference,
    });
  }

  const brands = await brandNameMap(db, [...byId.values()].map((row) => row.manufacturer_id));
  return [...byId.values()].map((row) => ({
    id: row.id,
    reference: row.reference,
    model_name: row.model_name,
    manufacturer: brands.get(row.manufacturer_id) || null,
    matched_via: row.matched_via,
    alias_reference: row.alias_reference,
  }));
}

router.get('/admin/offers', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const shopId = String(req.query.shop_id || '').trim();
    if (!isUuid(shopId)) return res.status(400).json({ error: 'shop_id no es un UUID válido' });
    const stock = String(req.query.stock || 'all');
    if (!['all', 'in', 'out'].includes(stock)) {
      return res.status(400).json({ error: 'stock debe ser all, in o out' });
    }

    let query = db
      .from('catalog_shop_offers')
      .select('id, catalog_item_id, price, previous_price, currency, in_stock, product_url, short_code, updated_at, slot_catalog_items!inner(reference, model_name, discontinued, manufacturer_id)')
      .eq('shop_id', shopId)
      .eq('slot_catalog_items.discontinued', false)
      .order('in_stock', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(40);
    if (stock === 'in') query = query.eq('in_stock', true);
    if (stock === 'out') query = query.eq('in_stock', false);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const brands = await brandNameMap(db, (data || []).map((row) => {
      const item = Array.isArray(row.slot_catalog_items) ? row.slot_catalog_items[0] : row.slot_catalog_items;
      return item?.manufacturer_id;
    }));
    res.json({
      offers: (data || []).map((row) => {
        const item = Array.isArray(row.slot_catalog_items) ? row.slot_catalog_items[0] : row.slot_catalog_items;
        return offerAdminRow({
          ...row,
          manufacturer: brands.get(item?.manufacturer_id) || null,
        });
      }),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/admin/offers', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const parsed = validateManualOffer(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });

    const { data: shop, error: shopError } = await db
      .from('catalog_shops')
      .select('id, currency')
      .eq('id', parsed.value.shop_id)
      .maybeSingle();
    if (shopError) return res.status(500).json({ error: shopError.message });
    if (!shop) return res.status(404).json({ error: 'Tienda no encontrada' });

    let item;
    if (parsed.value.catalog_item_id) {
      const { data, error: itemError } = await db
        .from('slot_catalog_items')
        .select('id, reference, model_name, discontinued, manufacturer_id')
        .eq('id', parsed.value.catalog_item_id)
        .maybeSingle();
      if (itemError) return res.status(500).json({ error: itemError.message });
      if (!data) return res.status(404).json({ error: 'La referencia no está en el catálogo' });
      item = data;
    } else {
      let matches;
      try {
        matches = await findCatalogMatches(db, parsed.value.reference);
      } catch (matchError) {
        return res.status(500).json({ error: matchError.message });
      }
      if (matches.length === 0) {
        return res.status(404).json({ error: 'La referencia no está en el catálogo' });
      }
      if (matches.length > 1) {
        return res.status(409).json({
          error: 'Hay varias fichas con esa referencia. Elige la marca.',
          matches,
        });
      }
      item = {
        id: matches[0].id,
        reference: matches[0].reference,
        model_name: matches[0].model_name,
        manufacturer: matches[0].manufacturer,
        discontinued: false,
      };
    }
    if (item.discontinued) {
      return res.status(400).json({ error: 'Esta referencia está descatalogada' });
    }
    if (!item.manufacturer && item.manufacturer_id) {
      const brands = await brandNameMap(db, [item.manufacturer_id]);
      item = { ...item, manufacturer: brands.get(item.manufacturer_id) || null };
    }

    const { data: existing, error: existingError } = await db
      .from('catalog_shop_offers')
      .select('id, price, previous_price, short_code')
      .eq('shop_id', shop.id)
      .eq('catalog_item_id', item.id)
      .maybeSingle();
    if (existingError) return res.status(500).json({ error: existingError.message });

    const now = new Date().toISOString();
    const prices = nextOfferPrices({
      price: parsed.value.price != null ? parsed.value.price : existing?.price,
      existingPrice: existing?.price,
      existingPrevious: existing?.previous_price,
    });
    const patch = {
      product_url: parsed.value.product_url,
      price: prices.price,
      previous_price: prices.previous_price,
      currency: shop.currency || 'EUR',
      in_stock: parsed.value.in_stock,
      last_checked_at: now,
      last_attempt_at: now,
      last_check_error: null,
      updated_at: now,
    };

    let saved;
    if (existing) {
      const { data, error } = await db
        .from('catalog_shop_offers')
        .update(patch)
        .eq('id', existing.id)
        .select('id, catalog_item_id, price, previous_price, currency, in_stock, product_url, short_code, updated_at')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      saved = data;
    } else {
      let lastError = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await db
          .from('catalog_shop_offers')
          .insert({
            shop_id: shop.id,
            catalog_item_id: item.id,
            ...patch,
            short_code: createShortCode(),
          })
          .select('id, catalog_item_id, price, previous_price, currency, in_stock, product_url, short_code, updated_at')
          .single();
        if (!error) {
          saved = data;
          break;
        }
        lastError = error;
        const msg = `${error.message || ''} ${error.details || ''}`;
        if (!(error.code === '23505' && /short_code/i.test(msg))) {
          return res.status(500).json({ error: error.message });
        }
      }
      if (!saved) return res.status(500).json({ error: lastError?.message || 'No se pudo guardar la oferta' });
    }

    res.status(existing ? 200 : 201).json(offerAdminRow({
      ...saved,
      manufacturer: item.manufacturer || null,
      slot_catalog_items: item,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/catalog-matches', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const matches = await findCatalogMatches(db, req.query.reference);
    res.json({ matches });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/admin/offers/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'id no es un UUID válido' });
    const parsed = validateOfferPatch(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });

    const { data: existing, error: existingError } = await db
      .from('catalog_shop_offers')
      .select('id, catalog_item_id, price, previous_price, currency, in_stock, product_url, short_code, updated_at, slot_catalog_items!inner(reference, model_name, discontinued, manufacturer_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (existingError) return res.status(500).json({ error: existingError.message });
    if (!existing) return res.status(404).json({ error: 'Oferta no encontrada' });

    const now = new Date().toISOString();
    const patch = {
      last_checked_at: now,
      last_attempt_at: now,
      last_check_error: null,
      updated_at: now,
    };
    if (Object.prototype.hasOwnProperty.call(parsed.value, 'in_stock')) {
      patch.in_stock = parsed.value.in_stock;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.value, 'price')) {
      const prices = nextOfferPrices({
        price: parsed.value.price,
        existingPrice: existing.price,
        existingPrevious: existing.previous_price,
      });
      patch.price = prices.price;
      patch.previous_price = prices.previous_price;
    }

    const { data: saved, error } = await db
      .from('catalog_shop_offers')
      .update(patch)
      .eq('id', existing.id)
      .select('id, catalog_item_id, price, previous_price, currency, in_stock, product_url, short_code, updated_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const item = Array.isArray(existing.slot_catalog_items)
      ? existing.slot_catalog_items[0]
      : existing.slot_catalog_items;
    const brands = await brandNameMap(db, [item?.manufacturer_id]);
    res.json(offerAdminRow({
      ...saved,
      manufacturer: brands.get(item?.manufacturer_id) || null,
      slot_catalog_items: item,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/clicks', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;

    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: clicks, error: clickError } = await db
      .from('catalog_shop_offer_clicks')
      .select('offer_id, clicked_at')
      .gte('clicked_at', since);
    if (clickError) return res.status(500).json({ error: clickError.message });

    const countByOffer = {};
    for (const click of clicks || []) {
      countByOffer[click.offer_id] = (countByOffer[click.offer_id] || 0) + 1;
    }
    const offerIds = Object.keys(countByOffer);
    if (offerIds.length === 0) return res.json({ stats: [], shops: [], days, since });

    const { data: offers, error: offerError } = await db
      .from('catalog_shop_offers')
      .select('id, shop_id, catalog_item_id, product_url, short_code, in_stock, catalog_shops(id, name, country_code)')
      .in('id', offerIds);
    if (offerError) return res.status(500).json({ error: offerError.message });

    const itemIds = [...new Set((offers || []).map((row) => row.catalog_item_id).filter(Boolean))];
    let itemsById = new Map();
    if (itemIds.length > 0) {
      const { data: items, error: itemError } = await db
        .from('slot_catalog_items')
        .select('id, reference, model_name')
        .in('id', itemIds);
      if (itemError) return res.status(500).json({ error: itemError.message });
      itemsById = new Map((items || []).map((item) => [item.id, item]));
    }

    const shopTotals = new Map();
    const stats = (offers || []).map((row) => {
      const shop = shopFromEmbed(row);
      const clickCount = countByOffer[row.id] || 0;
      if (shop?.id) {
        const prev = shopTotals.get(shop.id) || {
          shop_id: shop.id,
          shop_name: shop.name,
          country_code: shop.country_code,
          click_count: 0,
        };
        prev.click_count += clickCount;
        shopTotals.set(shop.id, prev);
      }
      return {
        offer_id: row.id,
        short_code: row.short_code,
        product_url: row.product_url,
        in_stock: row.in_stock,
        click_count: clickCount,
        shop_id: shop?.id ?? row.shop_id,
        shop_name: shop?.name ?? null,
        country_code: shop?.country_code ?? null,
        catalog_item: itemsById.get(row.catalog_item_id) ?? null,
      };
    });
    stats.sort((a, b) => b.click_count - a.click_count);
    const shops = [...shopTotals.values()].sort((a, b) => b.click_count - a.click_count);

    res.json({ stats, shops, days, since });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/public/policies/:slug', async (req, res) => {
  try {
    const db = getAnonClient();
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'slug requerido' });

    const { data, error } = await db
      .from('site_policies')
      .select('slug, title, content_md, updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Política no encontrada' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/policies', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const { data, error } = await db
      .from('site_policies')
      .select('slug, title, content_md, updated_at')
      .order('slug');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ policies: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/admin/policies/:slug', authMiddleware, adminGuard, async (req, res) => {
  try {
    const db = requireAdminDb(res);
    if (!db) return;
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'slug requerido' });

    const updates = { slug, updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) updates.title = String(req.body.title ?? '').trim();
    if (req.body?.content_md !== undefined) updates.content_md = String(req.body.content_md ?? '').trim();

    const { data, error } = await db
      .from('site_policies')
      .upsert(updates, { onConflict: 'slug' })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
