/**
 * Slot Race Manager — cuenta web (JWT): estado de licencia e instalaciones
 */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const INSTALLATIONS_MAX = 3;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const router = express.Router();

function getAdminEmails() {
  const raw = process.env.LICENSE_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * GET /me
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) {
      console.error('licenseAccount me subscription', subErr);
      return res.status(500).json({ error: 'Error al leer suscripción' });
    }

    const { data: installations, error: insErr } = await supabaseAdmin
      .from('app_installations')
      .select('id, installation_id, label, registered_at, last_seen_at')
      .eq('user_id', userId)
      .order('registered_at', { ascending: false });

    if (insErr) {
      console.error('licenseAccount me installations', insErr);
      return res.status(500).json({ error: 'Error al leer instalaciones' });
    }

    return res.json({
      is_paid: sub?.is_paid === true,
      paid_since: sub?.paid_since ?? null,
      installations_max: INSTALLATIONS_MAX,
      installations_used: installations?.length ?? 0,
      installations: installations ?? [],
    });
  } catch (err) {
    console.error('licenseAccount me', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * PATCH /admin/subscription
 * Body: { target_user_id: string, is_paid: boolean }
 */
router.patch('/admin/subscription', async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    const admins = getAdminEmails();
    if (!email || admins.length === 0 || !admins.includes(email)) {
      return res.status(403).json({ error: 'Solo administradores' });
    }

    const { target_user_id: targetUserId, is_paid: isPaid } = req.body || {};
    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ error: 'target_user_id requerido' });
    }

    const paid = Boolean(isPaid);
    const row = {
      user_id: targetUserId,
      is_paid: paid,
      updated_at: new Date().toISOString(),
    };
    if (paid) {
      row.paid_since = new Date().toISOString();
    } else {
      row.paid_since = null;
    }

    const { error: upErr } = await supabaseAdmin.from('user_subscriptions').upsert(row, {
      onConflict: 'user_id',
    });

    if (upErr) {
      console.error('licenseAccount admin upsert', upErr);
      return res.status(500).json({ error: 'No se pudo actualizar la suscripción' });
    }

    return res.json({ ok: true, user_id: targetUserId, is_paid: paid });
  } catch (err) {
    console.error('licenseAccount admin', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

module.exports = router;
