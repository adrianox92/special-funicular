/**
 * Admin dashboard — licencias Slot Lap Timer (user_licenses / RevenueCat webhooks).
 * GET /lap-timer-licenses?page=1&limit=25
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');

const router = express.Router();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * GET /lap-timer-licenses
 */
router.get('/lap-timer-licenses', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabase = getServiceClient();
    if (!supabase) {
      return res.status(503).json({
        error: 'Servicio no disponible: falta SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const since7d = daysAgoIso(7);
    const since30d = daysAgoIso(30);

    const [
      { count: totalActive },
      { count: totalInactive },
      { count: iosActive },
      { count: androidActive },
      { count: activations7d },
      { count: activations30d },
      { count: deactivations30d },
      { data: licenses, count: totalCount, error: listErr },
    ] = await Promise.all([
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', false),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', true).eq('platform', 'ios'),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', true).eq('platform', 'android'),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', true).gte('updated_at', since7d),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', true).gte('updated_at', since30d),
      supabase.from('user_licenses').select('*', { count: 'exact', head: true }).eq('active', false).gte('updated_at', since30d),
      supabase
        .from('user_licenses')
        .select('id, user_id, rc_app_user_id, platform, product_id, active, source, updated_at', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(from, to),
    ]);

    if (listErr) {
      console.error('[adminLapTimerLicenses] list:', listErr);
      return res.status(500).json({ error: listErr.message });
    }

    res.json({
      summary: {
        total_active: totalActive ?? 0,
        total_inactive: totalInactive ?? 0,
        ios_active: iosActive ?? 0,
        android_active: androidActive ?? 0,
        activations_7d: activations7d ?? 0,
        activations_30d: activations30d ?? 0,
        deactivations_30d: deactivations30d ?? 0,
      },
      licenses: licenses ?? [],
      total: totalCount ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('[adminLapTimerLicenses]', err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

module.exports = router;
