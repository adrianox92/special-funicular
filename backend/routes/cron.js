const express = require('express');
const cronAuth = require('../middleware/cronAuth');
const authMiddleware = require('../middleware/auth');
const { runWeeklyDigest, buildWeeklyDigestForUser } = require('../lib/weeklyDigest');
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

module.exports = router;
