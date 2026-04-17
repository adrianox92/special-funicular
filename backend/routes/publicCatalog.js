/**
 * Catálogo slot — solo lectura, sin autenticación.
 */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PUBLIC_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_slug, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, image_url, updated_at, rating_avg, rating_count';

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

/**
 * GET /facets — valores distintos para filtros con conteos
 */
router.get('/facets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select('manufacturer, manufacturer_slug, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release');
    if (error) return res.status(500).json({ error: error.message });

    const manufacturerMap   = new Map(); // slug -> { name, slug, count }
    const vehicleTypeCounts = new Map();
    const tractionCounts    = new Map();
    const motorPositionCounts = new Map();
    const yearCounts        = new Map();

    for (const row of data || []) {
      if (row.manufacturer != null && String(row.manufacturer).trim() !== '') {
        const name = String(row.manufacturer).trim();
        const slug = String(row.manufacturer_slug || '').trim();
        const key  = slug || name.toLowerCase();
        const prev = manufacturerMap.get(key) || { name, slug, count: 0 };
        manufacturerMap.set(key, { ...prev, count: prev.count + 1 });
      }
      if (row.vehicle_type != null && String(row.vehicle_type).trim() !== '') {
        const v = String(row.vehicle_type).trim();
        vehicleTypeCounts.set(v, (vehicleTypeCounts.get(v) || 0) + 1);
      }
      if (row.traction != null && String(row.traction).trim() !== '') {
        const t = String(row.traction).trim();
        tractionCounts.set(t, (tractionCounts.get(t) || 0) + 1);
      }
      if (row.motor_position != null && String(row.motor_position).trim() !== '') {
        const m = String(row.motor_position).trim();
        motorPositionCounts.set(m, (motorPositionCounts.get(m) || 0) + 1);
      }
      if (row.commercial_release_year != null && Number.isFinite(Number(row.commercial_release_year))) {
        const y = Number(row.commercial_release_year);
        yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
      }
    }

    res.json({
      manufacturers: Array.from(manufacturerMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')),
      vehicle_types: Array.from(vehicleTypeCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      tractions: Array.from(tractionCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      motor_positions: Array.from(motorPositionCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      years: Array.from(yearCounts.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => b.year - a.year),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /brands — lista de marcas con slug (desplegables / formularios públicos)
 */
router.get('/brands', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .select('id, name, logo_url, slug')
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ brands: data ?? [] });
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
 *   q                  — búsqueda libre (reference, model_name, manufacturer)
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
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

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

    let resolvedManufacturerId = null;

    // Resolver manufacturer_slug → manufacturer_id
    if (manufacturerSlug) {
      const { data: brand } = await supabase
        .from('slot_catalog_brands')
        .select('id')
        .eq('slug', manufacturerSlug)
        .maybeSingle();
      if (brand) resolvedManufacturerId = brand.id;
      else return res.json({ items: [], total: 0, page, limit, totalPages: 0 });
    }

    // manufacturer_id explícito (prioridad si no hay slug)
    if (!resolvedManufacturerId && manufacturerId && isUuid(manufacturerId)) {
      resolvedManufacturerId = manufacturerId;
    }

    let q_builder = supabase
      .from('slot_catalog_items_with_ratings')
      .select(PUBLIC_SELECT, { count: 'exact' });

    // Marca
    if (resolvedManufacturerId) {
      q_builder = q_builder.eq('manufacturer_id', resolvedManufacturerId);
    } else if (manufacturerText) {
      q_builder = q_builder.ilike('manufacturer', `%${escapeIlikePattern(manufacturerText)}%`);
    }

    // Tipo
    if (vehicleType) {
      q_builder = q_builder.eq('vehicle_type', vehicleType);
    }

    // Tracción
    if (tractionFilter) {
      q_builder = q_builder.eq('traction', tractionFilter);
    }

    // Año exacto (legacy)
    if (year != null && Number.isFinite(year)) {
      q_builder = q_builder.eq('commercial_release_year', year);
    }

    // Búsqueda libre
    if (q) {
      const escaped = escapeIlikePattern(q);
      q_builder = q_builder.or(
        `reference.ilike.%${escaped}%,model_name.ilike.%${escaped}%,manufacturer.ilike.%${escaped}%`,
      );
    }

    // Posición de motor
    if (motorPosition) {
      q_builder = q_builder.eq('motor_position', motorPosition);
    }

    // Descatalogado / próximo lanzamiento
    if (discontinuedRaw === 'true')    q_builder = q_builder.eq('discontinued', true);
    if (discontinuedRaw === 'false')   q_builder = q_builder.eq('discontinued', false);
    if (upcomingReleaseRaw === 'true')  q_builder = q_builder.eq('upcoming_release', true);
    if (upcomingReleaseRaw === 'false') q_builder = q_builder.eq('upcoming_release', false);

    // Rango de años
    if (yearFrom != null && Number.isFinite(yearFrom)) {
      q_builder = q_builder.gte('commercial_release_year', yearFrom);
    }
    if (yearTo != null && Number.isFinite(yearTo)) {
      q_builder = q_builder.lte('commercial_release_year', yearTo);
    }

    // Ordenación
    switch (sort) {
      case 'year_desc':
        q_builder = q_builder
          .order('commercial_release_year', { ascending: false, nullsFirst: false })
          .order('manufacturer', { ascending: true })
          .order('reference',    { ascending: true });
        break;
      case 'rating_desc':
        q_builder = q_builder
          .order('rating_avg',  { ascending: false, nullsFirst: false })
          .order('manufacturer', { ascending: true })
          .order('reference',    { ascending: true });
        break;
      case 'newest':
        q_builder = q_builder
          .order('created_at', { ascending: false });
        break;
      default: // 'manufacturer'
        q_builder = q_builder
          .order('manufacturer', { ascending: true })
          .order('reference',    { ascending: true });
    }

    q_builder = q_builder.range(from, to);

    const { data, error, count } = await q_builder;
    if (error) return res.status(500).json({ error: error.message });

    const total = count ?? 0;
    res.json({
      items: data ?? [],
      total,
      page,
      limit,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    });
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
    const { data, error } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select(`${PUBLIC_SELECT}, created_at`)
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Ítem no encontrado' });

    let registered_user_count = 0;
    const { data: countVal, error: countErr } = await supabase.rpc(
      'slot_catalog_item_registered_user_count',
      { p_catalog_item_id: id },
    );
    if (countErr) {
      console.warn('[publicCatalog] registered_user_count', countErr.message);
    } else if (countVal != null && Number.isFinite(Number(countVal))) {
      registered_user_count = Number(countVal);
    }

    res.json({ ...data, registered_user_count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
