const express = require('express');
const { getAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { normalizePilotSlug, isValidPilotSlug, SLUG_MIN, SLUG_MAX } = require('../lib/pilotProfileUtils');

const router = express.Router();
const supabase = getAnonClient();

router.use(authMiddleware);

function defaultInternalSlug(userId) {
  return `u${String(userId).replace(/-/g, '')}`;
}

/**
 * GET /api/pilot-profile
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pilot_public_profiles')
      .select('slug, enabled, display_name, created_at, updated_at')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.json({
        slug: null,
        enabled: false,
        display_name: null,
        created_at: null,
        updated_at: null,
      });
    }

    return res.json(data);
  } catch (e) {
    console.error('GET /pilot-profile:', e);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
});

/**
 * PATCH /api/pilot-profile
 * Body: { slug?, enabled?, display_name? }
 */
router.patch('/', async (req, res) => {
  try {
    const body = req.body || {};
    const now = new Date().toISOString();

    const { data: existing, error: exErr } = await supabase
      .from('pilot_public_profiles')
      .select('slug, enabled, display_name')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (exErr) {
      return res.status(500).json({ error: exErr.message });
    }

    let nextEnabled = existing?.enabled ?? false;
    if (body.enabled !== undefined) {
      nextEnabled = Boolean(body.enabled);
    }

    let nextDisplay = existing?.display_name ?? null;
    if (body.display_name !== undefined) {
      const d = body.display_name;
      nextDisplay = d === null || d === '' ? null : String(d).trim().slice(0, 120);
    }

    let nextSlug;
    if (body.slug !== undefined) {
      const raw = body.slug === null || body.slug === '' ? '' : normalizePilotSlug(body.slug);
      nextSlug = raw === '' ? null : raw;
    } else {
      nextSlug = existing?.slug ?? null;
    }

    if (nextEnabled) {
      if (!nextSlug || !isValidPilotSlug(nextSlug)) {
        return res.status(400).json({
          error: `Con el perfil público activado, indica un slug válido (${SLUG_MIN}-${SLUG_MAX} caracteres: minúsculas, números y guiones).`,
        });
      }
    }

    const slugToStore = nextEnabled && nextSlug
      ? nextSlug
      : nextSlug && isValidPilotSlug(nextSlug)
        ? nextSlug
        : existing?.slug || defaultInternalSlug(req.user.id);

    const { data: conflict } = await supabase
      .from('pilot_public_profiles')
      .select('user_id')
      .ilike('slug', slugToStore)
      .neq('user_id', req.user.id)
      .maybeSingle();

    if (conflict) {
      return res.status(409).json({ error: 'Ese slug ya está en uso' });
    }

    const row = {
      user_id: req.user.id,
      slug: slugToStore,
      enabled: nextEnabled,
      display_name: nextDisplay,
      updated_at: now,
    };

    if (!existing) {
      const { data: inserted, error: insErr } = await supabase
        .from('pilot_public_profiles')
        .insert([row])
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          return res.status(409).json({ error: 'Ese slug ya está en uso' });
        }
        return res.status(500).json({ error: insErr.message });
      }
      return res.json(inserted);
    }

    const { data: updated, error: updErr } = await supabase
      .from('pilot_public_profiles')
      .update({
        slug: slugToStore,
        enabled: nextEnabled,
        display_name: nextDisplay,
        updated_at: now,
      })
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updErr) {
      if (updErr.code === '23505') {
        return res.status(409).json({ error: 'Ese slug ya está en uso' });
      }
      return res.status(500).json({ error: updErr.message });
    }

    return res.json(updated);
  } catch (e) {
    console.error('PATCH /pilot-profile:', e);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
});

module.exports = router;
