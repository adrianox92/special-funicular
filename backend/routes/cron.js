const express = require('express');
const cronAuth = require('../middleware/cronAuth');
const authMiddleware = require('../middleware/auth');
const { runWeeklyDigest, buildWeeklyDigestForUser } = require('../lib/weeklyDigest');
const { runCatalogGapReport } = require('../lib/catalogGapReport');
const { getAdapter } = require('../lib/shopAdapters');
const { runShopOfferBatch, runShopOfferLookup, createSupabaseShopOfferIo } = require('../lib/shopOfferSync');
const { createShortCode } = require('../lib/shortCode');
const { getServiceClient } = require('../lib/supabaseClients');
const { sendWeeklyDigestNotification } = require('../lib/notifier');

const router = express.Router();

/**
 * POST /api/cron/weekly-digest
 * Header: Authorization: Bearer ${CRON_SECRET}
 * Query: force=1 (procesar todos los usuarios con digest activo, ignorar día)
 */
router.post('/weekly-digest', cronAuth, async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const results = await runWeeklyDigest({ force });
    res.json({ ok: true, ...results });
  } catch (e) {
    console.error('[cron] weekly-digest:', e);
    res.status(500).json({ error: e.message || 'Error al enviar digest' });
  }
});

/**
 * POST /api/cron/weekly-digest/test
 * JWT — envía digest de prueba solo al usuario actual.
 */
router.post('/weekly-digest/test', authMiddleware, async (req, res) => {
  try {
    const admin = getServiceClient();
    if (!admin) return res.status(503).json({ error: 'Service role no disponible' });
    const digest = await buildWeeklyDigestForUser(admin, req.user.id);
    await sendWeeklyDigestNotification(req.user.id, digest);
    res.json({ ok: true, message: 'Resumen semanal de prueba enviado.' });
  } catch (e) {
    if (e.code === 'NO_CHANNELS') {
      return res.status(400).json({ error: e.message });
    }
    console.error('[cron] weekly-digest/test:', e);
    res.status(500).json({ error: e.message || 'Error al enviar digest de prueba' });
  }
});

/**
 * POST /api/cron/catalog-gap-report
 * Header: Authorization: Bearer ${CRON_SECRET}
 * Query: force=1 (enviar aunque no sean las 9:00 Europe/Madrid de un lunes o jueves)
 *
 * Render Cron: `0 7,8 * * 1,4` (UTC: 07:00 y 08:00, lunes y jueves).
 * El job solo envía cuando en Madrid son las 9:00 de un lunes o jueves.
 */
router.post('/catalog-gap-report', cronAuth, async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const result = await runCatalogGapReport({ force });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] catalog-gap-report:', e);
    res.status(500).json({ error: e.message || 'Error al enviar informe de catálogo' });
  }
});

/**
 * POST /api/cron/shop-offers
 * Header: Authorization: Bearer ${CRON_SECRET}
 *
 * Render Cron diario `0 6 * * *` (06:00 UTC). Cada ejecución recomprueba
 * las 40 ofertas con el intento más antiguo y busca 20 referencias nuevas
 * por tienda. Las más antiguas van primero, así que no se queda atascado
 * en un fallo de red. No recorre el catálogo entero en un solo request.
 */
router.post('/shop-offers', cronAuth, async (req, res) => {
  try {
    const admin = getServiceClient();
    if (!admin) return res.status(503).json({ error: 'Service role no disponible' });
    const reference = String(req.query.reference || '').trim();
    if (reference) {
      const result = await runShopOfferLookup({
        io: createSupabaseShopOfferIo(admin, { createShortCode }),
        getAdapter,
        reference,
        pauseMs: 200,
        newShortCode: createShortCode,
      });
      if (!result.found) {
        return res.status(404).json({ error: 'La referencia no está en el catálogo', reference });
      }
      return res.json({ ok: true, ...result });
    }
    const result = await runShopOfferBatch({
      io: createSupabaseShopOfferIo(admin, { createShortCode }),
      getAdapter,
      newShortCode: createShortCode,
      pauseMs: 200,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] shop-offers:', e);
    res.status(500).json({ error: e.message || 'Error al revisar ofertas de tienda' });
  }
});

module.exports = router;
