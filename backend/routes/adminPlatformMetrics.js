/**
 * Métricas de plataforma (solo LICENSE_ADMIN_EMAILS). Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');

const router = express.Router();

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const REFS_GAP_MIN_LIMIT = 1;
const REFS_GAP_MAX_LIMIT = 100;

function parseRefsGapQuery(req) {
  const limRaw = req.query.limit;
  const offRaw = req.query.offset;
  const lim =
    limRaw === undefined || limRaw === ''
      ? 25
      : Number.parseInt(String(limRaw), 10);
  const off =
    offRaw === undefined || offRaw === ''
      ? 0
      : Number.parseInt(String(offRaw), 10);
  if (!Number.isFinite(lim) || !Number.isFinite(off)) {
    return { error: 'limit y offset deben ser enteros.' };
  }
  const limit = Math.min(REFS_GAP_MAX_LIMIT, Math.max(REFS_GAP_MIN_LIMIT, lim));
  const offset = Math.max(0, off);
  const only =
    req.query.only_unlinked === true ||
    req.query.only_unlinked === 'true' ||
    req.query.only_unlinked === '1';
  return { limit, offset, only_unlinked: only };
}

function parseIsoDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = Date.parse(s.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s || '').trim(),
  );
}

/**
 * GET /platform-metrics?from=&to=
 * Intervalo semicerrado [from, to) en ISO 8601.
 */
router.get('/platform-metrics', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Servicio de métricas no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      });
    }

    const from = parseIsoDate(req.query.from);
    const to = parseIsoDate(req.query.to);
    if (!from || !to) {
      return res.status(400).json({ error: 'Parámetros from y to requeridos (ISO 8601).' });
    }
    if (from.getTime() >= to.getTime()) {
      return res.status(400).json({ error: 'from debe ser anterior a to.' });
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      return res.status(400).json({ error: 'El rango máximo permitido es 366 días.' });
    }

    const p_from = from.toISOString();
    const p_to = to.toISOString();

    const { data, error } = await supabaseAdmin.rpc('admin_platform_metrics', {
      p_from,
      p_to,
    });

    if (error) {
      console.error('admin_platform_metrics:', error);
      return res.status(500).json({ error: error.message || 'Error al calcular métricas' });
    }

    const row = data;
    const payload =
      row && typeof row === 'object' && !Array.isArray(row)
        ? row
        : {};

    res.json({
      from: p_from,
      to: p_to,
      vehicles_total: payload.vehicles_total ?? 0,
      vehicles_with_catalog_item_id: payload.vehicles_with_catalog_item_id ?? 0,
      users_created: payload.users_created ?? 0,
      users_active: payload.users_active ?? 0,
      competitions_created: payload.competitions_created ?? 0,
      vehicles_in_period: payload.vehicles_in_period ?? 0,
      vehicles_by_user: Array.isArray(payload.vehicles_by_user)
        ? payload.vehicles_by_user
        : [],
    });
  } catch (err) {
    console.error('adminPlatformMetrics:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * GET /vehicle-refs-not-in-catalog?limit=&offset=&only_unlinked=
 * Referencias de garaje sin equivalencia en catálogo (normalización trim + lower).
 */
router.get('/vehicle-refs-not-in-catalog', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Servicio no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      });
    }

    const parsed = parseRefsGapQuery(req);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_vehicle_refs_missing_catalog', {
      p_limit: parsed.limit,
      p_offset: parsed.offset,
      p_only_unlinked: parsed.only_unlinked,
    });

    if (error) {
      console.error('admin_vehicle_refs_missing_catalog:', error);
      return res.status(500).json({ error: error.message || 'Error al calcular referencias' });
    }

    const payload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? data
        : {};

    res.json({
      total: typeof payload.total === 'number' ? payload.total : 0,
      limit: typeof payload.limit === 'number' ? payload.limit : parsed.limit,
      offset: typeof payload.offset === 'number' ? payload.offset : parsed.offset,
      only_unlinked: !!payload.only_unlinked,
      rows: Array.isArray(payload.rows) ? payload.rows : [],
    });
  } catch (err) {
    console.error('vehicle-refs-not-in-catalog:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * POST /link-garage-refs-to-catalog
 * Body JSON: garage_reference, catalog_reference, catalog_manufacturer_id, garage_manufacturer? (opcional)
 */
router.post('/link-garage-refs-to-catalog', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Servicio no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      });
    }

    const garageRef = req.body?.garage_reference != null ? String(req.body.garage_reference).trim() : '';
    const catalogRef = req.body?.catalog_reference != null ? String(req.body.catalog_reference).trim() : '';
    const catalogManufacturerId = req.body?.catalog_manufacturer_id != null ? String(req.body.catalog_manufacturer_id).trim() : '';
    const garageManufacturer =
      req.body?.garage_manufacturer != null ? String(req.body.garage_manufacturer).trim() : '';

    if (!garageRef || !catalogRef || !catalogManufacturerId) {
      return res.status(400).json({
        error: 'garage_reference, catalog_reference y catalog_manufacturer_id son obligatorios.',
      });
    }
    if (!isUuid(catalogManufacturerId)) {
      return res.status(400).json({ error: 'catalog_manufacturer_id no es un UUID válido.' });
    }
    const { data: catalogRows, error: catErr } = await supabaseAdmin
      .from('slot_catalog_items')
      .select('id, reference')
      .eq('manufacturer_id', catalogManufacturerId);

    if (catErr) {
      console.error('link-garage-refs catalog lookup:', catErr);
      return res.status(500).json({ error: catErr.message || 'Error al buscar el ítem de catálogo' });
    }

    const catNorm = catalogRef.toLowerCase();
    const matches = (catalogRows ?? []).filter(
      (r) => r.reference != null && String(r.reference).trim().toLowerCase() === catNorm,
    );

    if (matches.length === 0) {
      return res.status(404).json({
        error: 'No hay ningún ítem del catálogo con esa referencia para la marca indicada.',
      });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Varios ítems coinciden; revisa datos en base de datos.' });
    }

    const catalogItemId = matches[0].id;

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
      'admin_link_vehicles_by_garage_ref_to_catalog_item',
      {
        p_garage_ref: garageRef,
        p_garage_manufacturer: garageManufacturer !== '' ? garageManufacturer : null,
        p_catalog_item_id: catalogItemId,
      },
    );

    if (rpcErr) {
      console.error('admin_link_vehicles_by_garage_ref_to_catalog_item:', rpcErr);
      return res.status(500).json({ error: rpcErr.message || 'Error al enlazar vehículos' });
    }

    const updatedCount = typeof rpcData === 'number' ? rpcData : Number(rpcData);
    res.json({ updated_count: Number.isFinite(updatedCount) ? updatedCount : 0 });
  } catch (err) {
    console.error('link-garage-refs-to-catalog:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

module.exports = router;
