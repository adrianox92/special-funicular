/**
 * Catálogo slot — solo lectura, sin autenticación.
 */
const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const { fetchSupabaseRangePage } = require('../lib/supabaseRangePage');
const { fetchCatalogNeighbors } = require('../lib/catalogNeighbors');
const { fetchCatalogSimilar } = require('../lib/catalogSimilar');

const router = express.Router();
const supabase = getAnonClient();

const { CATALOG_TECH_SPEC_SELECT } = require('../lib/catalogTechSpecs');
const {
  attachAliasesToCatalogItems,
  findCatalogItemIdsByAliasOrEan,
  catalogSearchOrClause,
} = require('../lib/catalogAliases');
const { rewritePublicCatalogResponse } = require('../lib/publicCatalogImageUrls');
const { fetchCatalogCompleteHighlights } = require('../lib/catalogHighlights');
const { createTtlCache } = require('../lib/ttlCache');

const FACETS_TTL_MS = 10 * 60 * 1000;
const BRANDS_TTL_MS = 10 * 60 * 1000;
const ITEMS_TTL_MS = 3 * 60 * 1000;
const DETAIL_TTL_MS = 10 * 60 * 1000;

const facetsCache = createTtlCache({ ttlMs: FACETS_TTL_MS, maxEntries: 4 });
const brandsCache = createTtlCache({ ttlMs: BRANDS_TTL_MS, maxEntries: 4 });
const itemsCache = createTtlCache({ ttlMs: ITEMS_TTL_MS, maxEntries: 100 });
const detailCache = createTtlCache({ ttlMs: DETAIL_TTL_MS, maxEntries: 500 });

/** Techo del listado público: la UI usa 24; 48 cubre grids densos sin dump masivo. */
const PUBLIC_ITEMS_MAX_LIMIT = 48;

const PUBLIC_LIST_SELECT =
  'id, reference, ean, manufacturer_id, manufacturer, manufacturer_slug, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, dorsal, limited_edition, limited_edition_total, real_race_results_url, real_race_photos_url, image_url, updated_at, rating_avg, rating_count';

const PUBLIC_SELECT = PUBLIC_LIST_SELECT;

const PUBLIC_DETAIL_SELECT = `${PUBLIC_LIST_SELECT}, ${CATALOG_TECH_SPEC_SELECT}, car_make, car_model`;

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

function publicCatalogCacheKey(scope, payload) {
  return `${scope}:${process.env.PUBLIC_IMAGE_ORIGIN || ''}:${JSON.stringify(payload)}`;
}

function clearPublicCatalogCache() {
  facetsCache.clear();
  brandsCache.clear();
  itemsCache.clear();
  detailCache.clear();
}

function sortByName(rows) {
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function shapeFacets(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const manufacturers = sortByName(
    (Array.isArray(src.manufacturers) ? src.manufacturers : [])
      .map((row) => ({
        name: String(row?.name ?? '').trim(),
        slug: String(row?.slug ?? '').trim(),
        count: Number(row?.count) || 0,
      }))
      .filter((row) => row.name),
  );
  const named = (key) => sortByName(
    (Array.isArray(src[key]) ? src[key] : [])
      .map((row) => ({
        name: String(row?.name ?? '').trim(),
        count: Number(row?.count) || 0,
      }))
      .filter((row) => row.name),
  );
  const years = (Array.isArray(src.years) ? src.years : [])
    .map((row) => ({
      year: Number(row?.year),
      count: Number(row?.count) || 0,
    }))
    .filter((row) => Number.isFinite(row.year))
    .sort((a, b) => b.year - a.year);

  return {
    manufacturers,
    vehicle_types: named('vehicle_types'),
    tractions: named('tractions'),
    motor_positions: named('motor_positions'),
    years,
  };
}

/**
 * GET /facets — valores distintos para filtros con conteos
 */
router.get('/facets', async (req, res) => {
  try {
    const key = publicCatalogCacheKey('facets', {});
    const hit = facetsCache.get(key);
    if (hit) return res.json(hit);

    const { data, error } = await supabase.rpc('catalog_public_facets');
    if (error) return res.status(500).json({ error: error.message });

    const body = shapeFacets(data);
    facetsCache.set(key, body);
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /brands — lista de marcas con slug (desplegables / formularios públicos)
 */
router.get('/brands', async (req, res) => {
  try {
    const key = publicCatalogCacheKey('brands', {});
    const hit = brandsCache.get(key);
    if (hit) return res.json(hit);

    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .select('id, name, logo_url, slug')
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const body = rewritePublicCatalogResponse({ brands: data ?? [] });
    brandsCache.set(key, body);
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /highlights — un modelo 100% completo por marca, para el carrusel del homepage.
 */
router.get('/highlights', async (req, res) => {
  try {
    const items = await fetchCatalogCompleteHighlights(supabase);
    res.json(rewritePublicCatalogResponse({ items }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items — listado paginado con filtros avanzados
 *
 * Parámetros SEO básicos (van en path y se traducen a query):
 *   manufacturer_slug  — slug de la marca (prioridad sobre manufacturer)
 *   manufacturer       — texto parcial de la marca (legacy)
 *   manufacturer_id    — uuid exacto de la marca
 *   vehicle_type       — tipo exacto
 *   traction           — tracción exacta
 *   year               — año exacto (legacy)
 *
 * Filtros extra (query string):
 *   q                  — búsqueda libre (reference, alias, ean, model_name, manufacturer)
 *   motor_position     — posición de motor exacta
 *   discontinued       — "true" | "false"
 *   upcoming_release   — "true" | "false"
 *   year_from          — año >= n
 *   year_to            — año <= n
 *   sort               — "manufacturer" (default) | "year_desc" | "rating_desc" | "newest"
 *   page, limit
 */
router.get('/items', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  || '1'),  10) || 1);
    const limit = Math.min(
      PUBLIC_ITEMS_MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24),
    );

    // --- Filtros básicos (SEO path) ---
    const manufacturerSlug = String(req.query.manufacturer_slug ?? '').trim();
    const manufacturerText = String(req.query.manufacturer      ?? '').trim();
    const manufacturerId   = String(req.query.manufacturer_id   ?? '').trim();
    const vehicleType      = String(req.query.vehicle_type      ?? '').trim();
    const tractionFilter   = String(req.query.traction          ?? '').trim();
    const yearRaw  = req.query.year ?? req.query.commercial_release_year;
    const year     = yearRaw === '' || yearRaw == null ? null : parseInt(String(yearRaw), 10);

    // --- Filtros extra ---
    const q              = String(req.query.q              ?? '').trim();
    const motorPosition  = String(req.query.motor_position ?? '').trim();
    const discontinuedRaw    = req.query.discontinued;
    const upcomingReleaseRaw = req.query.upcoming_release;
    const yearFrom = req.query.year_from != null && req.query.year_from !== ''
      ? parseInt(String(req.query.year_from), 10) : null;
    const yearTo   = req.query.year_to   != null && req.query.year_to   !== ''
      ? parseInt(String(req.query.year_to),   10) : null;
    const sort = String(req.query.sort ?? 'manufacturer').trim();

    const listKey = publicCatalogCacheKey('items', {
      page,
      limit,
      manufacturerSlug,
      manufacturerText,
      manufacturerId,
      vehicleType,
      tractionFilter,
      year,
      q,
      motorPosition,
      discontinuedRaw: discontinuedRaw ?? null,
      upcomingReleaseRaw: upcomingReleaseRaw ?? null,
      yearFrom,
      yearTo,
      sort,
    });
    const listHit = itemsCache.get(listKey);
    if (listHit) return res.json(listHit);

    const aliasIds = q
      ? await findCatalogItemIdsByAliasOrEan(supabase, q, { limit: 80 })
      : [];

    let resolvedManufacturerId = null;

    // Resolver manufacturer_slug → manufacturer_id
    if (manufacturerSlug) {
      const { data: brand } = await supabase
        .from('slot_catalog_brands')
        .select('id')
        .eq('slug', manufacturerSlug)
        .maybeSingle();
      if (brand) resolvedManufacturerId = brand.id;
      else {
        const empty = { items: [], total: 0, page, limit, totalPages: 0 };
        itemsCache.set(listKey, empty);
        return res.json(empty);
      }
    }

    // manufacturer_id explícito (prioridad si no hay slug)
    if (!resolvedManufacturerId && manufacturerId && isUuid(manufacturerId)) {
      resolvedManufacturerId = manufacturerId;
    }

    const buildPublicCatalogItemsQuery = (opts = {}) => {
      const selectOpts =
        opts.head === true ? { count: 'exact', head: true } : { count: 'exact' };
      let q_builder = supabase
        .from('slot_catalog_items_with_ratings')
        .select(PUBLIC_SELECT, selectOpts);

      if (resolvedManufacturerId) {
        q_builder = q_builder.eq('manufacturer_id', resolvedManufacturerId);
      } else if (manufacturerText) {
        q_builder = q_builder.ilike('manufacturer', `%${escapeIlikePattern(manufacturerText)}%`);
      }

      if (vehicleType) {
        q_builder = q_builder.eq('vehicle_type', vehicleType);
      }

      if (tractionFilter) {
        q_builder = q_builder.eq('traction', tractionFilter);
      }

      if (year != null && Number.isFinite(year)) {
        q_builder = q_builder.eq('commercial_release_year', year);
      }

      if (q) {
        q_builder = q_builder.or(catalogSearchOrClause(q, aliasIds));
      }

      if (motorPosition) {
        q_builder = q_builder.eq('motor_position', motorPosition);
      }

      if (discontinuedRaw === 'true') q_builder = q_builder.eq('discontinued', true);
      if (discontinuedRaw === 'false') q_builder = q_builder.eq('discontinued', false);
      if (upcomingReleaseRaw === 'true') q_builder = q_builder.eq('upcoming_release', true);
      if (upcomingReleaseRaw === 'false') q_builder = q_builder.eq('upcoming_release', false);

      if (yearFrom != null && Number.isFinite(yearFrom)) {
        q_builder = q_builder.gte('commercial_release_year', yearFrom);
      }
      if (yearTo != null && Number.isFinite(yearTo)) {
        q_builder = q_builder.lte('commercial_release_year', yearTo);
      }

      if (opts.head !== true) {
        switch (sort) {
          case 'year_desc':
            q_builder = q_builder
              .order('commercial_release_year', { ascending: false, nullsFirst: false })
              .order('manufacturer', { ascending: true })
              .order('reference', { ascending: true });
            break;
          case 'rating_desc':
            q_builder = q_builder
              .order('rating_avg', { ascending: false, nullsFirst: false })
              .order('manufacturer', { ascending: true })
              .order('reference', { ascending: true });
            break;
          case 'newest':
            q_builder = q_builder.order('created_at', { ascending: false });
            break;
          default:
            q_builder = q_builder
              .order('manufacturer', { ascending: true })
              .order('reference', { ascending: true });
        }
      }

      return q_builder;
    };

    const { data, count, totalPages } = await fetchSupabaseRangePage(buildPublicCatalogItemsQuery, {
      page,
      limit,
    });

    const body = rewritePublicCatalogResponse({
      items: data,
      total: count,
      page,
      limit,
      totalPages,
    });
    itemsCache.set(listKey, body);
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items/:id — detalle público
 */
router.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }
    const detailKey = publicCatalogCacheKey('item', { id });
    const detailHit = detailCache.get(detailKey);
    if (detailHit) {
      if (detailHit.missing) return res.status(404).json({ error: 'Ítem no encontrado' });
      return res.json(detailHit.body);
    }
    const { data, error } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select(`${PUBLIC_DETAIL_SELECT}, created_at`)
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) {
      detailCache.set(detailKey, { missing: true });
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }

    let registered_user_count = 0;
    const countClient = getServiceClient() || supabase;
    const { data: countVal, error: countErr } = await countClient.rpc(
      'slot_catalog_item_registered_user_count',
      { p_catalog_item_id: id },
    );
    if (countErr) {
      console.warn('[publicCatalog] registered_user_count', countErr.message);
    } else if (countVal != null && Number.isFinite(Number(countVal))) {
      registered_user_count = Number(countVal);
    }

    let neighbors = { prev: null, next: null };
    try {
      // Orden estable: manufacturer ASC (nulls last), reference ASC, id ASC (igual que sort=manufacturer).
      neighbors = await fetchCatalogNeighbors(supabase, data);
    } catch (neighborErr) {
      console.warn('[publicCatalog] neighbors', neighborErr.message);
    }

    let similar = [];
    try {
      similar = await fetchCatalogSimilar(supabase, data);
    } catch (similarErr) {
      console.warn('[publicCatalog] similar', similarErr.message);
      similar = [];
    }

    const withAliases = await attachAliasesToCatalogItems(supabase, data);
    const body = rewritePublicCatalogResponse({
      ...withAliases,
      registered_user_count,
      neighbors,
      similar,
    });
    detailCache.set(detailKey, { missing: false, body });
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.PUBLIC_ITEMS_MAX_LIMIT = PUBLIC_ITEMS_MAX_LIMIT;
module.exports.clearPublicCatalogCache = clearPublicCatalogCache;
module.exports.shapeFacets = shapeFacets;
