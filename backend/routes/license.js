/**
 * Slot Race Manager — registro de instalaciones con X-API-Key
 */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const INSTALLATIONS_MAX = 3;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const router = express.Router();

/**
 * POST /register
 * Body: { installation_id: string, label?: string }
 */
router.post('/register', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto' });
    }

    const { installation_id: installationId, label } = req.body || {};
    if (!installationId || typeof installationId !== 'string') {
      return res.status(400).json({ error: 'installation_id requerido' });
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('is_paid')
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) {
      console.error('license register subscription', subErr);
      return res.status(500).json({ error: 'Error al leer suscripción' });
    }

    const isPaid = sub?.is_paid === true;
    if (!isPaid) {
      return res.json({
        tier: 'trial',
        installations_used: 0,
        installations_max: INSTALLATIONS_MAX,
      });
    }

    const { data: existing, error: exErr } = await supabaseAdmin
      .from('app_installations')
      .select('id')
      .eq('user_id', userId)
      .eq('installation_id', installationId)
      .maybeSingle();

    if (exErr) {
      console.error('license register existing', exErr);
      return res.status(500).json({ error: 'Error al comprobar instalación' });
    }

    const now = new Date().toISOString();

    if (existing?.id) {
      const patch = { last_seen_at: now };
      if (typeof label === 'string' && label.trim()) {
        patch.label = label.trim();
      }
      await supabaseAdmin.from('app_installations').update(patch).eq('id', existing.id);

      const { count } = await supabaseAdmin
        .from('app_installations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      return res.json({
        tier: 'full',
        installations_used: count ?? 0,
        installations_max: INSTALLATIONS_MAX,
      });
    }

    const { count: currentCount, error: cntErr } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (cntErr) {
      console.error('license register count', cntErr);
      return res.status(500).json({ error: 'Error al contar instalaciones' });
    }

    if ((currentCount ?? 0) >= INSTALLATIONS_MAX) {
      return res.status(403).json({
        error: 'installations_limit_exceeded',
        installations_max: INSTALLATIONS_MAX,
        installations_used: currentCount ?? 0,
      });
    }

    const { error: insErr } = await supabaseAdmin.from('app_installations').insert({
      user_id: userId,
      installation_id: installationId,
      label: typeof label === 'string' && label.trim() ? label.trim() : null,
    });

    if (insErr) {
      console.error('license register insert', insErr);
      return res.status(500).json({ error: 'No se pudo registrar la instalación' });
    }

    const { count: newCount } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return res.json({
      tier: 'full',
      installations_used: newCount ?? 0,
      installations_max: INSTALLATIONS_MAX,
    });
  } catch (err) {
    console.error('license register', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

/**
 * GET /status?installation_id=...
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto' });
    }

    const installationId = req.query.installation_id;
    if (!installationId || typeof installationId !== 'string') {
      return res.status(400).json({ error: 'installation_id requerido' });
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('is_paid')
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) {
      console.error('license status subscription', subErr);
      return res.status(500).json({ error: 'Error al leer suscripción' });
    }

    const isPaid = sub?.is_paid === true;
    if (!isPaid) {
      return res.json({
        tier: 'trial',
        installations_used: 0,
        installations_max: INSTALLATIONS_MAX,
      });
    }

    const { data: row, error: rowErr } = await supabaseAdmin
      .from('app_installations')
      .select('id')
      .eq('user_id', userId)
      .eq('installation_id', installationId)
      .maybeSingle();

    if (rowErr) {
      console.error('license status row', rowErr);
      return res.status(500).json({ error: 'Error al comprobar instalación' });
    }

    if (!row?.id) {
      return res.json({
        tier: 'trial',
        installations_used: 0,
        installations_max: INSTALLATIONS_MAX,
      });
    }

    await supabaseAdmin
      .from('app_installations')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', row.id);

    const { count } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return res.json({
      tier: 'full',
      installations_used: count ?? 0,
      installations_max: INSTALLATIONS_MAX,
    });
  } catch (err) {
    console.error('license status', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

module.exports = router;
