/**
 * Slot Race Manager — registro de instalaciones con X-API-Key
 * Modo personal: hasta INSTALLATIONS_MAX instalaciones por usuario.
 * Modo club: cupo compartido por club_id (columna clubs.license_installations_max).
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');

const INSTALLATIONS_MAX = 3;

const supabaseAdmin = getServiceClient();

const router = express.Router();

async function resolveClubLicenseScope(userId, clubIdRaw) {
  if (clubIdRaw == null || clubIdRaw === '') {
    return { ok: true, clubId: null, max: INSTALLATIONS_MAX };
  }
  const clubId = typeof clubIdRaw === 'string' ? clubIdRaw.trim() : String(clubIdRaw);
  const { data: club } = await supabaseAdmin
    .from('clubs')
    .select('id, license_installations_max, owner_user_id')
    .eq('id', clubId)
    .maybeSingle();
  if (!club) return { ok: false, error: 'club_not_found' };
  const { data: mem } = await supabaseAdmin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!mem && club.owner_user_id !== userId) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true, clubId, max: club.license_installations_max };
}

/**
 * POST /register
 * Body: { installation_id: string, label?: string, club_id?: uuid }
 */
router.post('/register', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no resuelto' });
    }

    const { installation_id: installationId, label, club_id: clubIdBody } = req.body || {};
    if (!installationId || typeof installationId !== 'string') {
      return res.status(400).json({ error: 'installation_id requerido' });
    }

    const clubScope = await resolveClubLicenseScope(userId, clubIdBody);
    if (!clubScope.ok) {
      if (clubScope.error === 'forbidden') {
        return res.status(403).json({ error: 'No perteneces a este club' });
      }
      return res.status(400).json({ error: 'club_id inválido' });
    }

    const requestedClubId = clubScope.clubId;
    const clubMax = clubScope.max;

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
      .select('id, club_id')
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
      if (requestedClubId && !existing.club_id) {
        patch.club_id = requestedClubId;
      }
      await supabaseAdmin.from('app_installations').update(patch).eq('id', existing.id);

      const effectiveClubId = patch.club_id ?? existing.club_id ?? requestedClubId;

      if (effectiveClubId) {
        const { data: club } = await supabaseAdmin
          .from('clubs')
          .select('license_installations_max')
          .eq('id', effectiveClubId)
          .maybeSingle();
        const { count } = await supabaseAdmin
          .from('app_installations')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', effectiveClubId);
        return res.json({
          tier: 'club',
          installations_used: count ?? 0,
          installations_max: club?.license_installations_max ?? 10,
        });
      }

      const { count } = await supabaseAdmin
        .from('app_installations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('club_id', null);

      return res.json({
        tier: 'full',
        installations_used: count ?? 0,
        installations_max: INSTALLATIONS_MAX,
      });
    }

    if (requestedClubId) {
      const { count: currentCount, error: cntErr } = await supabaseAdmin
        .from('app_installations')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', requestedClubId);

      if (cntErr) {
        console.error('license register count club', cntErr);
        return res.status(500).json({ error: 'Error al contar instalaciones del club' });
      }

      if ((currentCount ?? 0) >= clubMax) {
        return res.status(403).json({
          error: 'installations_limit_exceeded',
          installations_max: clubMax,
          installations_used: currentCount ?? 0,
        });
      }

      const { error: insErr } = await supabaseAdmin.from('app_installations').insert({
        user_id: userId,
        installation_id: installationId,
        label: typeof label === 'string' && label.trim() ? label.trim() : null,
        club_id: requestedClubId,
      });

      if (insErr) {
        console.error('license register insert', insErr);
        return res.status(500).json({ error: 'No se pudo registrar la instalación' });
      }

      const { count: newCount } = await supabaseAdmin
        .from('app_installations')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', requestedClubId);

      return res.json({
        tier: 'club',
        installations_used: newCount ?? 0,
        installations_max: clubMax,
      });
    }

    const { count: currentCount, error: cntErr } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('club_id', null);

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
      club_id: null,
    });

    if (insErr) {
      console.error('license register insert', insErr);
      return res.status(500).json({ error: 'No se pudo registrar la instalación' });
    }

    const { count: newCount } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('club_id', null);

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
 * GET /status?installation_id=...&club_id=... (club_id opcional para primera activación)
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
      .select('id, club_id')
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

    if (row.club_id) {
      const { data: club } = await supabaseAdmin
        .from('clubs')
        .select('license_installations_max')
        .eq('id', row.club_id)
        .maybeSingle();
      const { count } = await supabaseAdmin
        .from('app_installations')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', row.club_id);
      return res.json({
        tier: 'club',
        installations_used: count ?? 0,
        installations_max: club?.license_installations_max ?? 10,
      });
    }

    const { count } = await supabaseAdmin
      .from('app_installations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('club_id', null);

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
