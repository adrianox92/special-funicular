/**
 * Métricas de plataforma (solo LICENSE_ADMIN_EMAILS). Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');

const router = express.Router();

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

function parseIsoDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = Date.parse(s.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t);
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

module.exports = router;
