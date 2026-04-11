/**
 * Catálogo slot — solo lectura, sin autenticación.
 */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PUBLIC_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, image_url, updated_at, rating_avg, rating_count';

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
 * GET /facets — valores distintos para filtros
 */
router.get('/facets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select('manufacturer, vehicle_type, commercial_release_year');
    if (error) return res.status(500).json({ error: error.message });

    const manufacturers = new Set();
    const vehicleTypes = new Set();
    const years = new Set();
    for (const row of data || []) {
      if (row.manufacturer != null && String(row.manufacturer).trim() !== '') {
        manufacturers.add(String(row.manufacturer).trim());
      }
      if (row.vehicle_type != null && String(row.vehicle_type).trim() !== '') {
        vehicleTypes.add(String(row.vehicle_type).trim());
      }
      if (row.commercial_release_year != null && Number.isFinite(Number(row.commercial_release_year))) {
        years.add(Number(row.commercial_release_year));
      }
    }

    res.json({
      manufacturers: Array.from(manufacturers).sort((a, b) => a.localeCompare(b, 'es')),
      vehicle_types: Array.from(vehicleTypes).sort((a, b) => a.localeCompare(b, 'es')),
      years: Array.from(years).sort((a, b) => b - a),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /brands — lista de marcas (desplegables / formularios públicos)
 */
router.get('/brands', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .select('id,name,logo_url')
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ brands: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items — listado paginado con filtros
 */
router.get('/items', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const manufacturer = String(req.query.manufacturer ?? '').trim();
    const vehicleType = String(req.query.vehicle_type ?? '').trim();
    const yearRaw = req.query.year ?? req.query.commercial_release_year;
    const year =
      yearRaw === '' || yearRaw == null ? null : parseInt(String(yearRaw), 10);

    let q = supabase.from('slot_catalog_items_with_ratings').select(PUBLIC_SELECT, { count: 'exact' });

    if (manufacturer) {
      const p = `%${escapeIlikePattern(manufacturer)}%`;
      q = q.ilike('manufacturer', p);
    }
    if (vehicleType) {
      q = q.eq('vehicle_type', vehicleType);
    }
    if (year != null && Number.isFinite(year)) {
      q = q.eq('commercial_release_year', year);
    }

    q = q.order('manufacturer', { ascending: true }).order('reference', { ascending: true }).range(from, to);

    const { data, error, count } = await q;
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
