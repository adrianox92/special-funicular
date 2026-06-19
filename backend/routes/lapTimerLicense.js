/**
 * Slot Lap Timer — licencias Premium (RevenueCat / IAP)
 *
 * POST /register   X-API-Key  → registra compra en user_licenses
 * GET  /status     X-API-Key  → devuelve estado de licencia
 * POST /webhook               → recibe eventos RevenueCat (sin API key;
 *                               autenticado por cabecera Authorization)
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const revenueCatWebhookAuth = require('../middleware/revenueCatWebhookAuth');
const { hashApiKey } = require('../lib/apiKeyHash');

const router = express.Router();

function getSupabase() {
  const c = getServiceClient();
  if (!c) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  return c;
}

// ── POST /register ────────────────────────────────────────────────────────────
// Body: { app_user_id: string, platform: "ios" | "android" }
// Auth: X-API-Key
router.post('/register', apiKeyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto' });
    }

    const { app_user_id: appUserId, platform } = req.body || {};

    if (!appUserId || typeof appUserId !== 'string' || !appUserId.trim()) {
      return res.status(422).json({ error: 'app_user_id es requerido' });
    }
    if (!platform || !['ios', 'android'].includes(platform)) {
      return res.status(422).json({ error: 'platform debe ser "ios" o "android"' });
    }

    const supabase = getSupabase();
    const { error: upsertErr } = await supabase
      .from('user_licenses')
      .upsert(
        {
          user_id: userId,
          rc_app_user_id: appUserId.trim(),
          platform,
          active: true,
          source: 'iap',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (upsertErr) {
      console.error('[lapTimerLicense] register upsert:', upsertErr);
      return res.status(500).json({ error: 'Error al registrar la licencia' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[lapTimerLicense] register:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /status ───────────────────────────────────────────────────────────────
// Auth: X-API-Key
router.get('/status', apiKeyAuth, async (req, res) => {
  const inactive = { active: false, source: 'iap', product_id: null, updated_at: null };

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_licenses')
      .select('active, product_id, source, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[lapTimerLicense] status query:', error);
      return res.json(inactive);
    }

    if (!data || !data.active) {
      return res.json({
        active: false,
        source: data?.source ?? 'iap',
        product_id: null,
        updated_at: data?.updated_at ?? null,
      });
    }

    return res.json({
      active: true,
      source: data.source,
      product_id: data.product_id,
      updated_at: data.updated_at,
    });
  } catch (err) {
    console.error('[lapTimerLicense] status:', err);
    return res.json(inactive);
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
// Sin apiKeyAuth: autenticado por cabecera Authorization == REVENUECAT_WEBHOOK_SECRET.
// RevenueCat reintenta si recibe != 2xx → responde 200 siempre para evitar bucles.
async function handleRevenueCatWebhookEvent(req, res) {
  try {
    const event = req.body?.event;
    if (!event) {
      return res.sendStatus(200);
    }

    const { type: eventType, app_user_id: appUserId, transferred_to: transferredTo } = event;

    if (!appUserId) {
      return res.sendStatus(200);
    }

    const supabase = getSupabase();

    if (eventType === 'INITIAL_PURCHASE' || eventType === 'NON_RENEWING_PURCHASE') {
      // Buscar la fila existente por rc_app_user_id.
      const { data: existing } = await supabase
        .from('user_licenses')
        .select('user_id')
        .eq('rc_app_user_id', appUserId)
        .maybeSingle();

      if (existing?.user_id) {
        await supabase
          .from('user_licenses')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('rc_app_user_id', appUserId);
      } else {
        // Fallback: resolver user_id desde user_api_keys usando app_user_id como API key.
        try {
          const hash = hashApiKey(appUserId);
          const { data: keyRow } = await supabase
            .from('user_api_keys')
            .select('user_id')
            .eq('api_key_hash', hash)
            .maybeSingle();

          if (keyRow?.user_id) {
            await supabase.from('user_licenses').upsert(
              {
                user_id: keyRow.user_id,
                rc_app_user_id: appUserId,
                platform: 'ios',
                active: true,
                source: 'iap',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            );
          } else {
            console.warn('[lapTimerLicense] webhook: no se encontró user para app_user_id', appUserId);
          }
        } catch (hashErr) {
          console.error('[lapTimerLicense] webhook hashApiKey fallback:', hashErr);
        }
      }
    } else if (eventType === 'TRANSFER') {
      // transferredTo es un array en la API de RC; tomar el primero.
      const newAppUserId = Array.isArray(transferredTo)
        ? transferredTo[0]
        : transferredTo;
      if (newAppUserId) {
        await supabase
          .from('user_licenses')
          .update({
            rc_app_user_id: newAppUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('rc_app_user_id', appUserId);
      }
    } else if (eventType === 'REFUND' || eventType === 'EXPIRATION') {
      await supabase
        .from('user_licenses')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('rc_app_user_id', appUserId);
    }
    // Resto de eventos (RENEWAL, CANCELLATION, etc.) → ignorar.

    return res.sendStatus(200);
  } catch (err) {
    console.error('[lapTimerLicense] webhook:', err);
    return res.sendStatus(200);
  }
}

const revenueCatWebhookRoute = [revenueCatWebhookAuth, handleRevenueCatWebhookEvent];

router.post('/webhook', ...revenueCatWebhookRoute);

module.exports = router;
module.exports.revenueCatWebhookRoute = revenueCatWebhookRoute;
