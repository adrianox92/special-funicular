/**
 * Avisos in-app de «Lo busco».
 *
 *   GET  /unread-count
 *   GET  /                  recientes sin leer
 *   POST /mark-read         marca todos los del usuario
 *   POST /:id/read
 */

const express = require('express');
const { param, query } = require('express-validator');
const { createUserScopedClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function userDb(req) {
  return createUserScopedClient(req.headers.authorization);
}

const NOTICE_FIELDS = 'id, price, currency, shop_name, short_code, catalog_item_id, reference, model_name, read_at, created_at';

router.use(authMiddleware);

router.get('/unread-count', async (req, res) => {
  const db = userDb(req);
  const { count, error } = await db
    .from('catalog_price_watch_notices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .is('read_at', null);
  if (error) {
    console.error('[notifications] unread', error);
    return res.status(500).json({ error: 'No se pudo calcular los avisos' });
  }
  return res.json({ count: count ?? 0 });
});

router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  handleValidationErrors,
  async (req, res) => {
    const limit = req.query.limit ?? 8;
    const db = userDb(req);
    const { data, error } = await db
      .from('catalog_price_watch_notices')
      .select(NOTICE_FIELDS)
      .eq('user_id', req.user.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[notifications] list', error);
      return res.status(500).json({ error: 'No se pudieron cargar los avisos' });
    }
    return res.json({ notices: data || [] });
  },
);

router.post('/mark-read', async (req, res) => {
  const db = userDb(req);
  const { error } = await db
    .from('catalog_price_watch_notices')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', req.user.id)
    .is('read_at', null);
  if (error) {
    console.error('[notifications] mark-read', error);
    return res.status(500).json({ error: 'No se pudieron marcar los avisos' });
  }
  return res.json({ ok: true });
});

router.post(
  '/:id/read',
  param('id').custom((value) => isUuid(value)).withMessage('id inválido'),
  handleValidationErrors,
  async (req, res) => {
    const db = userDb(req);
    const { data, error } = await db
      .from('catalog_price_watch_notices')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id');
    if (error) {
      console.error('[notifications] read', error);
      return res.status(500).json({ error: 'No se pudo marcar el aviso' });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(404).json({ error: 'Aviso no encontrado' });
    return res.json({ ok: true });
  },
);

module.exports = router;
