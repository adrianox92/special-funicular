/**
 * Admin — códigos promocionales Slot Lap Timer.
 * GET  /promo-codes   JWT + LICENSE_ADMIN_EMAILS → listado paginado
 * POST /promo-codes   JWT + LICENSE_ADMIN_EMAILS → crea código pre-asignado a un email
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { generatePromoCode } = require('../lib/promoCodeGenerator');

const router = express.Router();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function getSupabase() {
  const client = getServiceClient();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  return client;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function insertUniqueCode(supabase, { assignedEmail, note }) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generatePromoCode();
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        code,
        assigned_email: assignedEmail,
        note: note ?? null,
      })
      .select('id, code, assigned_email, note, created_at, redeemed_at, redeemed_by_user_id')
      .single();

    if (!error) return data;

    if (error.code === '23505' && error.message?.includes('promo_codes_code_key')) {
      continue;
    }

    throw error;
  }

  throw new Error('No se pudo generar un código único');
}

// ── GET /promo-codes ────────────────────────────────────────────────────────
router.get('/promo-codes', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const supabase = getSupabase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const [
      { count: totalPending },
      { count: totalRedeemed },
      { data: codes, count: totalCount, error: listErr },
    ] = await Promise.all([
      supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .is('redeemed_by_user_id', null),
      supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .not('redeemed_by_user_id', 'is', null),
      supabase
        .from('promo_codes')
        .select('id, code, assigned_email, note, created_at, redeemed_at, redeemed_by_user_id')
        .order('created_at', { ascending: false })
        .range(from, to),
    ]);

    if (listErr) {
      console.error('[adminPromoCodes] list:', listErr);
      return res.status(500).json({ error: listErr.message });
    }

    return res.json({
      summary: {
        pending: totalPending ?? 0,
        redeemed: totalRedeemed ?? 0,
      },
      codes: codes ?? [],
      total: totalCount ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('[adminPromoCodes] list:', err);
    return res.status(500).json({ error: err?.message || 'Error interno del servidor' });
  }
});

// ── POST /promo-codes ───────────────────────────────────────────────────────
// Body: { email: string, note?: string }
router.post('/promo-codes', async (req, res) => {
  try {
    if (!assertLicenseAdmin(req, res)) return;

    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(422).json({ error: 'email es requerido' });
    }

    const assignedEmail = rawEmail.trim().toLowerCase();
    if (!isValidEmail(assignedEmail)) {
      return res.status(422).json({ error: 'email inválido' });
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;

    const supabase = getSupabase();
    const row = await insertUniqueCode(supabase, { assignedEmail, note });

    return res.status(201).json({
      code: row.code,
      assigned_email: row.assigned_email,
      note: row.note,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('[adminPromoCodes] create:', err);
    return res.status(500).json({ error: err?.message || 'Error interno del servidor' });
  }
});

module.exports = router;
