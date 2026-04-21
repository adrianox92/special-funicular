/**
 * Slot Race Manager — cuenta web (JWT): estado de licencia e instalaciones
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');

const INSTALLATIONS_MAX = 3;

const supabaseAdmin = getServiceClient();

const router = express.Router();

const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');

/**
 * Busca un usuario de Auth por email (paginación hasta ~20k usuarios).
 * @param {string} email
 * @returns {Promise<{ id: string, email?: string } | null>}
 */
async function findAuthUserByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return null;
  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === normalized);
    if (u) return { id: u.id, email: u.email };
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
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
 * GET /admin/lookup?email=
 * Resuelve email → usuario Auth + fila de suscripción (si existe).
 */
router.get('/admin/lookup', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const email = req.query.email;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Parámetro email requerido' });
    }

    const authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('is_paid, paid_since')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (subErr) {
      console.error('licenseAccount admin lookup subscription', subErr);
      return res.status(500).json({ error: 'Error al leer suscripción' });
    }

    return res.json({
      user_id: authUser.id,
      email: authUser.email ?? email.trim(),
      is_paid: sub?.is_paid === true,
      paid_since: sub?.paid_since ?? null,
    });
  } catch (err) {
    console.error('licenseAccount admin lookup', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * GET /admin/subscriptions
 * Lista suscripciones conocidas con email (máx. 200).
 */
router.get('/admin/subscriptions', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const { data: rows, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, is_paid, paid_since, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('licenseAccount admin subscriptions', error);
      return res.status(500).json({ error: 'Error al listar suscripciones' });
    }

    const out = [];
    for (const row of rows || []) {
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      if (uErr) {
        console.error('licenseAccount admin getUserById', row.user_id, uErr);
      }
      out.push({
        user_id: row.user_id,
        email: u?.user?.email ?? null,
        is_paid: row.is_paid === true,
        paid_since: row.paid_since ?? null,
        updated_at: row.updated_at ?? null,
      });
    }

    return res.json({ subscriptions: out });
  } catch (err) {
    console.error('licenseAccount admin subscriptions', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * PATCH /admin/subscription
 * Body: { target_user_id: string, is_paid: boolean }
 */
router.patch('/admin/subscription', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

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
