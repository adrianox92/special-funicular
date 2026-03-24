const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { isVapidReady, getVapidPublicKey } = require('../lib/pushNotifications');

const router = express.Router();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

router.use(authMiddleware);

/**
 * GET /api/push/vapid-public-key
 * Clave pública para PushManager.subscribe (también puede usarse REACT_APP_VAPID_PUBLIC_KEY).
 */
router.get('/vapid-public-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({
      error: 'VAPID no configurado en el servidor. Define VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.',
    });
  }
  res.json({ publicKey: key });
});

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth } }
 */
router.post('/subscribe', async (req, res) => {
  try {
    if (!isVapidReady()) {
      return res.status(503).json({
        error: 'VAPID no configurado en el servidor',
      });
    }

    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        error: 'Body requerido: { endpoint, keys: { p256dh, auth } }',
      });
    }

    const userId = req.user.id;
    const userAgent = req.headers['user-agent'] || null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: now,
        },
        { onConflict: 'endpoint', defaultToNull: false }
      )
      .select('id, created_at, updated_at')
      .single();

    if (error) {
      console.error('[push] Error al guardar suscripción:', error);
      if (error.code === '42P01') {
        return res.status(503).json({
          error:
            'La tabla push_subscriptions no existe. Ejecuta backend/scripts/add-push-subscriptions.sql en Supabase.',
        });
      }
      return res.status(500).json({ error: error.message || 'Error al guardar la suscripción' });
    }

    res.status(201).json({ ok: true, id: data.id, created_at: data.created_at, updated_at: data.updated_at });
  } catch (err) {
    console.error('Error en POST /api/push/subscribe:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Body: { endpoint } — debe coincidir con la suscripción del usuario.
 */
router.delete('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'Body requerido: { endpoint }' });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[push] Error al eliminar suscripción:', error);
      if (error.code === '42P01') {
        return res.status(503).json({
          error:
            'La tabla push_subscriptions no existe. Ejecuta backend/scripts/add-push-subscriptions.sql en Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en DELETE /api/push/unsubscribe:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
