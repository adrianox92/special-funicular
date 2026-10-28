/**
 * Métricas de plataforma (solo LICENSE_ADMIN_EMAILS). Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { fetchTimingRetentionKpi } = require('../lib/timingRetentionKpi');
const {
  parseRefsGapQuery,
  buildMissingCatalogRpcParams,
} = require('../lib/adminVehicleRefsQuery');

const router = express.Router();

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

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

/** ILIKE sin comodines: la referencia se compara entera, sin distinguir mayúsculas. */
function escapeIlikeExact(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Busca el ítem por referencia canónica o alias dentro de una marca.
 * El filtro va en la consulta: un select de toda la marca se queda en 1000 filas.
 */
async function findCatalogItemIdsByBrandReference(supabase, manufacturerId, reference) {
  const needle = reference.trim().toLowerCase();
  const pattern = escapeIlikeExact(reference.trim());
  const [itemsRes, aliasRes] = await Promise.all([
    supabase
      .from('slot_catalog_items')
      .select('id, reference')
      .eq('manufacturer_id', manufacturerId)
      .ilike('reference', pattern)
      .limit(5),
    supabase
      .from('slot_catalog_item_aliases')
      .select('catalog_item_id, alias_reference')
      .eq('manufacturer_id', manufacturerId)
      .ilike('alias_reference', pattern)
      .limit(5),
  ]);

  if (itemsRes.error) return { error: itemsRes.error };
  if (aliasRes.error) return { error: aliasRes.error };

  const ids = new Set();
  for (const row of itemsRes.data || []) {
    if (row?.id && String(row.reference ?? '').trim().toLowerCase() === needle) {
      ids.add(row.id);
    }
  }
  for (const row of aliasRes.data || []) {
    if (
      row?.catalog_item_id &&
      String(row.alias_reference ?? '').trim().toLowerCase() === needle
    ) {
      ids.add(row.catalog_item_id);
    }
  }
  return { ids: [...ids] };
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
 * GET /timing-retention
 * KPI rolling 30d (independiente del periodo del dashboard). Misma definición que la rutina SQL semanal.
 */
router.get('/timing-retention', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Servicio de métricas no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      });
    }

    const kpi = await fetchTimingRetentionKpi(supabaseAdmin);
    res.json(kpi);
  } catch (err) {
    console.error('timing-retention:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * GET /vehicle-refs-not-in-catalog?limit=&offset=&only_unlinked=&q=
 * Sin q: referencias de garaje sin equivalencia en catálogo (trim + lower).
 * Con q / reference / ref: contains sobre ref normalizada; incluye grupos ya presentes
 * en catálogo (in_catalog, catalog_item_id si el match de catálogo es único).
 * manufacturer / mfg / brand: contains sobre fabricante de garaje; agrupa por marca.
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

    const parsed = parseRefsGapQuery(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data, error } = await supabaseAdmin.rpc(
      'admin_vehicle_refs_missing_catalog',
      buildMissingCatalogRpcParams(parsed),
    );

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
      q: typeof payload.q === 'string' ? payload.q : parsed.q || null,
      manufacturer:
        typeof payload.manufacturer === 'string'
          ? payload.manufacturer
          : parsed.manufacturer || null,
      rows: Array.isArray(payload.rows) ? payload.rows : [],
    });
  } catch (err) {
    console.error('vehicle-refs-not-in-catalog:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * GET /catalog-link-suggestions?reference=&manufacturer=
 * Fichas cuya referencia coincide con la del garaje o termina en ella.
 */
router.get('/catalog-link-suggestions', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabaseAdmin = getServiceClient();
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Servicio no disponible: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      });
    }

    const reference = String(req.query.reference ?? req.query.q ?? '').trim().slice(0, 64);
    const manufacturer = String(req.query.manufacturer ?? req.query.mfg ?? '').trim().slice(0, 100);
    if (reference.length < 2) {
      return res.status(400).json({ error: 'reference debe tener al menos 2 caracteres.' });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_suggest_catalog_items_for_garage_ref', {
      p_reference: reference,
      p_manufacturer: manufacturer !== '' ? manufacturer : null,
    });

    if (error) {
      console.error('admin_suggest_catalog_items_for_garage_ref:', error);
      return res.status(500).json({ error: error.message || 'Error al buscar coincidencias' });
    }

    res.json({
      reference,
      manufacturer: manufacturer !== '' ? manufacturer : null,
      suggestions: Array.isArray(data) ? data : [],
    });
  } catch (err) {
    console.error('catalog-link-suggestions:', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * POST /link-garage-refs-to-catalog
 * Body JSON: garage_reference y, o bien catalog_item_id, o bien
 * catalog_reference + catalog_manufacturer_id. garage_manufacturer es opcional.
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
    const requestedItemId = req.body?.catalog_item_id != null ? String(req.body.catalog_item_id).trim() : '';
    const garageManufacturer =
      req.body?.garage_manufacturer != null ? String(req.body.garage_manufacturer).trim() : '';

    if (!garageRef) {
      return res.status(400).json({ error: 'garage_reference es obligatorio.' });
    }

    let catalogItemId = '';

    if (requestedItemId) {
      if (!isUuid(requestedItemId)) {
        return res.status(400).json({ error: 'catalog_item_id no es un UUID válido.' });
      }
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('slot_catalog_items')
        .select('id')
        .eq('id', requestedItemId)
        .maybeSingle();
      if (itemErr) {
        console.error('link-garage-refs catalog item:', itemErr);
        return res.status(500).json({ error: itemErr.message || 'Error al buscar el ítem de catálogo' });
      }
      if (!item?.id) {
        return res.status(404).json({ error: 'Ítem de catálogo no encontrado.' });
      }
      catalogItemId = item.id;
    } else {
      if (!catalogRef || !catalogManufacturerId) {
        return res.status(400).json({
          error: 'Indica catalog_item_id, o catalog_reference y catalog_manufacturer_id.',
        });
      }
      if (!isUuid(catalogManufacturerId)) {
        return res.status(400).json({ error: 'catalog_manufacturer_id no es un UUID válido.' });
      }

      const found = await findCatalogItemIdsByBrandReference(
        supabaseAdmin,
        catalogManufacturerId,
        catalogRef,
      );
      if (found.error) {
        console.error('link-garage-refs catalog lookup:', found.error);
        return res.status(500).json({ error: found.error.message || 'Error al buscar el ítem de catálogo' });
      }
      if (found.ids.length === 0) {
        return res.status(404).json({
          error: 'No hay ningún ítem del catálogo con esa referencia para la marca indicada.',
        });
      }
      if (found.ids.length > 1) {
        return res.status(409).json({ error: 'Varios ítems coinciden; revisa datos en base de datos.' });
      }
      catalogItemId = found.ids[0];
    }

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

router.get('/mcp-catalog-usage', async (req, res) => {
  if (!assertLicenseAdmin(req, res)) return;
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });
  }
  try {
    const { summarizeCatalogUsage } = require('../lib/mcpCatalogUsage');
    const summary = await summarizeCatalogUsage(supabaseAdmin);
    res.json(summary);
  } catch (err) {
    console.error('mcp-catalog-usage:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error al leer el uso del catálogo' });
  }
});

module.exports = router;
