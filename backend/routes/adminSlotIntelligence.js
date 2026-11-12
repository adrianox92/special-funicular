/**
 * Slot Database Intelligence (solo LICENSE_ADMIN_EMAILS).
 * Lee la foto agregada y la recalcula con service_role.
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');

const router = express.Router();

const STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 100000;

function serviceUnavailable(res) {
  return res.status(503).json({
    error: 'Servicio de inteligencia no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
  });
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInt(value) {
  const n = asNumber(value);
  return n == null ? 0 : Math.trunc(n);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim(),
  );
}

function parseListQuery(query) {
  const limitRaw = query.limit;
  const offsetRaw = query.offset;
  const sortRaw = query.sort == null || query.sort === '' ? 'owners' : String(query.sort);
  const manufacturerRaw = String(query.manufacturer_id ?? query.manufacturer ?? '').trim();
  const publishableRaw = query.publishable;

  let limit = DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw !== '') {
    if (!/^\d+$/.test(String(limitRaw))) {
      return { error: 'limit debe ser un entero entre 1 y 100.' };
    }
    limit = Number(limitRaw);
    if (limit < 1 || limit > MAX_LIMIT) {
      return { error: 'limit debe ser un entero entre 1 y 100.' };
    }
  }

  let offset = 0;
  if (offsetRaw != null && offsetRaw !== '') {
    if (!/^\d+$/.test(String(offsetRaw))) {
      return { error: 'offset debe ser un entero mayor o igual que 0.' };
    }
    offset = Number(offsetRaw);
    if (offset > MAX_OFFSET) {
      return { error: 'offset supera el máximo permitido.' };
    }
  }

  if (sortRaw !== 'owners' && sortRaw !== 'garage_price') {
    return { error: 'sort debe ser owners o garage_price.' };
  }

  let manufacturerId = null;
  if (manufacturerRaw) {
    if (!isUuid(manufacturerRaw)) {
      return { error: 'manufacturer_id no es un UUID válido.' };
    }
    manufacturerId = manufacturerRaw;
  }

  let publishable = null;
  if (publishableRaw != null && publishableRaw !== '') {
    const flag = String(publishableRaw).toLowerCase();
    if (flag === 'true' || flag === '1') publishable = true;
    else if (flag === 'false' || flag === '0') publishable = false;
    else return { error: 'publishable debe ser true o false.' };
  }

  return { limit, offset, sort: sortRaw, manufacturerId, publishable };
}

function mapSummary(row) {
  const histogram = Array.isArray(row.rarity_histogram) ? row.rarity_histogram : [];
  return {
    computed_at: row.computed_at,
    catalog_items_total: asInt(row.catalog_items_total),
    catalog_items_with_owners: asInt(row.catalog_items_with_owners),
    coverage_pct: asNumber(row.coverage_pct) ?? 0,
    linked_vehicle_count: asInt(row.linked_vehicle_count),
    linked_user_count: asInt(row.linked_user_count),
    vehicles_with_price: asInt(row.vehicles_with_price),
    price_coverage_pct: asNumber(row.price_coverage_pct) ?? 0,
    global_price_median: asNumber(row.global_price_median),
    global_price_p25: asNumber(row.global_price_p25),
    global_price_p75: asNumber(row.global_price_p75),
    publishable_item_count: asInt(row.publishable_item_count),
    top10_refs_vehicle_share_pct: asNumber(row.top10_refs_vehicle_share_pct) ?? 0,
    top5_brands_vehicle_share_pct: asNumber(row.top5_brands_vehicle_share_pct) ?? 0,
    rarity_histogram: histogram.map((entry) => ({
      bucket: entry?.bucket ?? '',
      item_count: asInt(entry?.item_count),
    })),
    garage_price_basis: row.garage_price_basis || 'declared_as_eur',
  };
}

function mapBrand(row) {
  return {
    manufacturer_id: row.manufacturer_id,
    brand_name: row.brand_name,
    catalog_item_count: asInt(row.catalog_item_count),
    items_with_owners: asInt(row.items_with_owners),
    coverage_pct: asNumber(row.coverage_pct) ?? 0,
    vehicle_count: asInt(row.vehicle_count),
    user_count: asInt(row.user_count),
    garage_price_n: asInt(row.garage_price_n),
    garage_price_median: asNumber(row.garage_price_median),
    listing_count: asInt(row.listing_count),
    listing_price_n: asInt(row.listing_price_n),
    listing_price_median: asNumber(row.listing_price_median),
  };
}

function mapItem(row) {
  return {
    catalog_item_id: row.catalog_item_id,
    manufacturer_id: row.manufacturer_id,
    brand_name: row.brand_name,
    reference: row.reference,
    model_name: row.model_name,
    vehicle_count: asInt(row.vehicle_count),
    owner_count: asInt(row.owner_count),
    penetration_pct: asNumber(row.penetration_pct) ?? 0,
    garage_price_n: asInt(row.garage_price_n),
    garage_price_median: asNumber(row.garage_price_median),
    garage_price_p25: asNumber(row.garage_price_p25),
    garage_price_p75: asNumber(row.garage_price_p75),
    listing_count: asInt(row.listing_count),
    listing_other_currency_count: asInt(row.listing_other_currency_count),
    listing_price_n: asInt(row.listing_price_n),
    listing_price_median: asNumber(row.listing_price_median),
    listing_new_n: asInt(row.listing_new_n),
    listing_new_median: asNumber(row.listing_new_median),
    listing_used_n: asInt(row.listing_used_n),
    listing_used_median: asNumber(row.listing_used_median),
    listing_preorder_n: asInt(row.listing_preorder_n),
    listing_preorder_median: asNumber(row.listing_preorder_median),
    publishable: !!row.publishable,
    prices_publishable: !!row.prices_publishable,
  };
}

function mapPlace(row) {
  return {
    scope: row.scope,
    manufacturer_id: row.manufacturer_id,
    brand_name: row.brand_name,
    place_label: row.place_label,
    vehicle_count: asInt(row.vehicle_count),
    user_count: asInt(row.user_count),
  };
}

async function computedAt(supabase) {
  const { data, error } = await supabase
    .from('slot_intelligence_summary')
    .select('computed_at')
    .limit(1)
    .maybeSingle();
  if (error) {
    const err = new Error(error.message || 'Error al leer la foto de inteligencia');
    err.status = 500;
    throw err;
  }
  return data?.computed_at ?? null;
}

function isStale(computedAtValue) {
  const ts = computedAtValue ? Date.parse(computedAtValue) : NaN;
  return !Number.isFinite(ts) || Date.now() - ts > STALE_MS;
}

async function refreshSnapshot(supabase) {
  const { error } = await supabase.rpc('slot_intelligence_refresh');
  if (error) {
    const err = new Error(error.message || 'Error al recalcular la inteligencia');
    err.status = 500;
    throw err;
  }
}

async function readSnapshot(supabase, listQuery) {
  const summaryRes = await supabase
    .from('slot_intelligence_summary')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (summaryRes.error) {
    const err = new Error(summaryRes.error.message || 'Error al leer el resumen');
    err.status = 500;
    throw err;
  }
  if (!summaryRes.data) {
    const err = new Error('No hay foto de inteligencia tras el cálculo.');
    err.status = 500;
    throw err;
  }

  const brandsRes = await supabase
    .from('slot_intelligence_brands')
    .select('*')
    .order('vehicle_count', { ascending: false })
    .order('brand_name', { ascending: true })
    .limit(1000);
  if (brandsRes.error) {
    const err = new Error(brandsRes.error.message || 'Error al leer las marcas');
    err.status = 500;
    throw err;
  }

  const globalPlacesRes = await supabase
    .from('slot_intelligence_purchase_places')
    .select('*')
    .eq('scope', 'global')
    .order('vehicle_count', { ascending: false })
    .order('place_label', { ascending: true })
    .limit(20);
  if (globalPlacesRes.error) {
    const err = new Error(globalPlacesRes.error.message || 'Error al leer los lugares');
    err.status = 500;
    throw err;
  }

  let brandPlaces = [];
  if (listQuery.manufacturerId) {
    const brandPlacesRes = await supabase
      .from('slot_intelligence_purchase_places')
      .select('*')
      .eq('scope', 'brand')
      .eq('manufacturer_id', listQuery.manufacturerId)
      .order('vehicle_count', { ascending: false })
      .order('place_label', { ascending: true })
      .limit(8);
    if (brandPlacesRes.error) {
      const err = new Error(brandPlacesRes.error.message || 'Error al leer los lugares de la marca');
      err.status = 500;
      throw err;
    }
    brandPlaces = Array.isArray(brandPlacesRes.data) ? brandPlacesRes.data : [];
  }

  let itemsQuery = supabase
    .from('slot_intelligence_items')
    .select('*', { count: 'exact' });
  if (listQuery.manufacturerId) {
    itemsQuery = itemsQuery.eq('manufacturer_id', listQuery.manufacturerId);
  }
  if (listQuery.publishable != null) {
    itemsQuery = itemsQuery.eq('publishable', listQuery.publishable);
  }
  if (listQuery.sort === 'garage_price') {
    itemsQuery = itemsQuery
      .order('garage_price_median', { ascending: false, nullsFirst: false })
      .order('owner_count', { ascending: false });
  } else {
    itemsQuery = itemsQuery
      .order('owner_count', { ascending: false })
      .order('vehicle_count', { ascending: false });
  }
  itemsQuery = itemsQuery.order('reference', { ascending: true });

  const itemsRes = await itemsQuery.range(listQuery.offset, listQuery.offset + listQuery.limit - 1);
  if (itemsRes.error) {
    const err = new Error(itemsRes.error.message || 'Error al leer las fichas');
    err.status = 500;
    throw err;
  }

  return {
    computed_at: summaryRes.data.computed_at,
    summary: mapSummary(summaryRes.data),
    brands: (brandsRes.data || []).map(mapBrand),
    places: {
      global: (globalPlacesRes.data || []).map(mapPlace),
      brand: brandPlaces.map(mapPlace),
    },
    items: {
      total: typeof itemsRes.count === 'number' ? itemsRes.count : (itemsRes.data || []).length,
      limit: listQuery.limit,
      offset: listQuery.offset,
      sort: listQuery.sort,
      manufacturer_id: listQuery.manufacturerId,
      publishable: listQuery.publishable,
      rows: (itemsRes.data || []).map(mapItem),
    },
  };
}

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error interno' });
}

router.get('/slot-intelligence', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) return serviceUnavailable(res);

    const listQuery = parseListQuery(req.query);
    if (listQuery.error) {
      return res.status(400).json({ error: listQuery.error });
    }

    const previous = await computedAt(supabaseAdmin);
    const staleRefreshed = isStale(previous);
    if (staleRefreshed) {
      await refreshSnapshot(supabaseAdmin);
    }

    const payload = await readSnapshot(supabaseAdmin, listQuery);
    res.json({ ...payload, stale_refreshed: staleRefreshed });
  } catch (err) {
    console.error('slot-intelligence:', err);
    sendError(res, err);
  }
});

router.post('/slot-intelligence/refresh', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) return serviceUnavailable(res);

    await refreshSnapshot(supabaseAdmin);
    const at = await computedAt(supabaseAdmin);
    res.json({ computed_at: at });
  } catch (err) {
    console.error('slot-intelligence/refresh:', err);
    sendError(res, err);
  }
});

module.exports = router;
