/**
 * Slot Lap Timer — códigos promocionales pre-asignados por email.
 *
 * POST /redeem   X-API-Key  → canjea un código vinculado al email del usuario
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { normalizePromoCode, formatPromoCode } = require('../lib/promoCodeGenerator');

const router = express.Router();

function getSupabase() {
  const client = getServiceClient();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  return client;
}

async function getUserEmail(supabase, userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email.trim().toLowerCase();
}

// ── POST /redeem ──────────────────────────────────────────────────────────────
// Body: { code: string }
// Auth: X-API-Key
router.post('/redeem', apiKeyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto', code: 'UNAUTHORIZED' });
    }

    const rawCode = req.body?.code;
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(422).json({ error: 'El código es requerido', code: 'INVALID_INPUT' });
    }

    const normalized = normalizePromoCode(rawCode);
    const canonicalCode = formatPromoCode(normalized);
    if (!canonicalCode) {
      return res.status(422).json({ error: 'Formato de código inválido', code: 'INVALID_INPUT' });
    }

    const supabase = getSupabase();

    const { data: existingLicense } = await supabase
      .from('user_licenses')
      .select('active')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingLicense?.active) {
      return res.status(409).json({
        error: 'Ya tienes acceso Premium activo',
        code: 'ALREADY_PREMIUM',
      });
    }

    const userEmail = await getUserEmail(supabase, userId);
    if (!userEmail) {
      return res.status(500).json({ error: 'No se pudo verificar tu cuenta', code: 'USER_EMAIL_MISSING' });
    }

    const { data: promoRow, error: promoErr } = await supabase
      .from('promo_codes')
      .select('id, code, assigned_email, redeemed_by_user_id')
      .eq('code', canonicalCode)
      .maybeSingle();

    if (promoErr) {
      console.error('[promoCodes] lookup:', promoErr);
      return res.status(500).json({ error: 'Error al validar el código', code: 'SERVER_ERROR' });
    }

    if (!promoRow) {
      return res.status(404).json({ error: 'Código no encontrado', code: 'CODE_NOT_FOUND' });
    }

    if (promoRow.redeemed_by_user_id) {
      return res.status(409).json({ error: 'Este código ya fue canjeado', code: 'CODE_ALREADY_USED' });
    }

    const assignedEmail = promoRow.assigned_email.trim().toLowerCase();
    if (assignedEmail !== userEmail) {
      return res.status(403).json({
        error: 'Este código no está asignado a tu cuenta',
        code: 'CODE_WRONG_USER',
      });
    }

    const { data: redeemedRow, error: redeemErr } = await supabase
      .from('promo_codes')
      .update({
        redeemed_by_user_id: userId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', promoRow.id)
      .is('redeemed_by_user_id', null)
      .select('id')
      .maybeSingle();

    if (redeemErr) {
      console.error('[promoCodes] redeem update:', redeemErr);
      if (redeemErr.code === '23505') {
        return res.status(409).json({
          error: 'Ya has canjeado un código promocional',
          code: 'ALREADY_REDEEMED',
        });
      }
      return res.status(500).json({ error: 'Error al canjear el código', code: 'SERVER_ERROR' });
    }

    if (!redeemedRow) {
      return res.status(409).json({ error: 'Este código ya fue canjeado', code: 'CODE_ALREADY_USED' });
    }

    const { error: licenseErr } = await supabase
      .from('user_licenses')
      .upsert(
        {
          user_id: userId,
          rc_app_user_id: `promo_${userId}`,
          platform: 'ios',
          product_id: 'slot_lap_timer_premium',
          active: true,
          source: 'promo',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (licenseErr) {
      console.error('[promoCodes] license upsert:', licenseErr);
      await supabase
        .from('promo_codes')
        .update({ redeemed_by_user_id: null, redeemed_at: null })
        .eq('id', promoRow.id)
        .eq('redeemed_by_user_id', userId);
      return res.status(500).json({ error: 'Error al activar Premium', code: 'SERVER_ERROR' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[promoCodes] redeem:', err);
    return res.status(500).json({ error: 'Error interno del servidor', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
