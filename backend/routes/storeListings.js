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
 *   GET  /admin/clicks
 *   GET/PUT /admin/policies
 *
 * El redirect con clic vive en GET /api/go/:code.
 */

const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { validateShopInput } = require('../lib/shopInput');
const { isPublicOffer, publicOfferCutoff } = require('../lib/shopOfferSync');

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
  return {
    id: row.id,
    short_code: row.short_code,
    price: row.price,
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
      .select('id, price, currency, short_code, in_stock, last_checked_at, catalog_shops!inner(name, country_code, logo_url, active)')
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
