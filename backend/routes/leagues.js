const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const {
  requireViewLeague,
  requireManageLeague,
  userIsClubMember,
} = require('../lib/leaguePermissions');
const { computeLeagueStandings } = require('../lib/leagueStandings');

const router = express.Router();
const supabase = getServiceOrAnonClient();

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

function generateLeagueSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const uuid = uuidv4().substring(0, 8);
  return `${baseSlug}-${uuid}`;
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { data: owned, error: ownedErr } = await supabase
      .from('leagues')
      .select('*, clubs ( id, name, slug )')
      .eq('organizer', req.user.id)
      .order('created_at', { ascending: false });

    if (ownedErr) {
      return res.status(500).json({ error: ownedErr.message });
    }

    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', req.user.id);

    const memberClubIds = (memberships || []).map((m) => m.club_id);

    const { data: ownedClubs } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_user_id', req.user.id);

    const allClubIds = [
      ...new Set([...memberClubIds, ...(ownedClubs || []).map((c) => c.id)]),
    ];

    let clubLeagues = [];
    if (allClubIds.length > 0) {
      const { data, error } = await supabase
        .from('leagues')
        .select('*, clubs ( id, name, slug )')
        .in('club_id', allClubIds)
        .neq('organizer', req.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      clubLeagues = data || [];
    }

    const merged = new Map();
    for (const l of [...(owned || []), ...clubLeagues]) {
      merged.set(l.id, l);
    }

    res.json(Array.from(merged.values()));
  } catch (error) {
    console.error('GET /leagues:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/',
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('scoring_mode').optional().isIn(['league_rules', 'per_competition']),
  body('club_id').optional({ values: 'falsy' }).isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, scoring_mode = 'league_rules', club_id } = req.body;

      if (club_id) {
        const isMember = await userIsClubMember(supabase, req.user.id, club_id);
        if (!isMember) {
          return res.status(403).json({ error: 'No perteneces a este club' });
        }
      }

      const insertData = {
        name: name.trim(),
        slug: generateLeagueSlug(name.trim()),
        organizer: req.user.id,
        club_id: club_id || null,
        status: 'draft',
        scoring_mode,
      };

      const { data, error } = await supabase
        .from('leagues')
        .insert([insertData])
        .select('*, clubs ( id, name, slug )')
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('POST /leagues:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.get('/my-competitions/available', async (req, res) => {
  try {
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('id, name, status, club_id, public_slug, created_at')
      .eq('organizer', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const { data: linked } = await supabase
      .from('league_competitions')
      .select('competition_id');

    const linkedIds = new Set((linked || []).map((l) => l.competition_id));

    res.json((competitions || []).filter((c) => !linkedIds.has(c.id)));
  } catch (error) {
    console.error('GET /leagues/my-competitions/available:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const access = await requireViewLeague(supabase, req.user, req.params.id);
    if (!access.ok) return access.respond(res);

    const { data: leagueCompetitions, error: lcErr } = await supabase
      .from('league_competitions')
      .select(`
        id,
        order_index,
        competition_id,
        competitions (
          id,
          name,
          status,
          rounds,
          num_slots,
          public_slug,
          circuit_name,
          created_at
        )
      `)
      .eq('league_id', req.params.id)
      .order('order_index', { ascending: true });

    if (lcErr) {
      return res.status(500).json({ error: lcErr.message });
    }

    const { data: participants, error: pErr } = await supabase
      .from('league_participants')
      .select('*, vehicles ( id, model, manufacturer )')
      .eq('league_id', req.params.id)
      .order('created_at', { ascending: true });

    if (pErr) {
      return res.status(500).json({ error: pErr.message });
    }

    const { count: rulesCount } = await supabase
      .from('competition_rules')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', req.params.id)
      .eq('is_template', false);

    const { data: club } = access.league.club_id
      ? await supabase
          .from('clubs')
          .select('id, name, slug')
          .eq('id', access.league.club_id)
          .maybeSingle()
      : { data: null };

    res.json({
      ...access.league,
      club: club || null,
      competitions: (leagueCompetitions || []).map((row) => ({
        link_id: row.id,
        order_index: row.order_index,
        ...row.competitions,
      })),
      participants: participants || [],
      rules_count: rulesCount || 0,
      can_manage: access.league.organizer === req.user.id,
    });
  } catch (error) {
    console.error('GET /leagues/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put(
  '/:id',
  param('id').isUUID(),
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('status').optional().isIn(['draft', 'published', 'running', 'closed']),
  body('scoring_mode').optional().isIn(['league_rules', 'per_competition']),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const updates = {};
      if (req.body.name != null) updates.name = String(req.body.name).trim();
      if (req.body.status != null) updates.status = req.body.status;

      if (req.body.scoring_mode != null && req.body.scoring_mode !== access.league.scoring_mode) {
        const { count: compCount } = await supabase
          .from('league_competitions')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', req.params.id);

        const { count: rulesCount } = await supabase
          .from('competition_rules')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', req.params.id)
          .eq('is_template', false);

        if ((compCount || 0) > 0 || (rulesCount || 0) > 0) {
          return res.status(400).json({
            error: 'No se puede cambiar el modo de puntuación cuando la liga ya tiene pruebas o reglas',
          });
        }
        updates.scoring_mode = req.body.scoring_mode;
      }

      if (Object.keys(updates).length === 0) {
        return res.json(access.league);
      }

      const { data, error } = await supabase
        .from('leagues')
        .update(updates)
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(data);
    } catch (error) {
      console.error('PUT /leagues/:id:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  '/:id/competitions',
  param('id').isUUID(),
  body('competition_id').isUUID(),
  body('order_index').optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const { competition_id, order_index } = req.body;

      const { data: competition, error: compErr } = await supabase
        .from('competitions')
        .select('id, organizer, club_id')
        .eq('id', competition_id)
        .maybeSingle();

      if (compErr || !competition) {
        return res.status(404).json({ error: 'Competición no encontrada' });
      }

      if (competition.organizer !== req.user.id) {
        return res.status(403).json({ error: 'Solo puedes añadir competiciones que organices' });
      }

      if (access.league.club_id && competition.club_id !== access.league.club_id) {
        return res.status(400).json({ error: 'La competición debe pertenecer al mismo club que la liga' });
      }

      const { data: existingLink } = await supabase
        .from('league_competitions')
        .select('id, league_id')
        .eq('competition_id', competition_id)
        .maybeSingle();

      if (existingLink) {
        return res.status(400).json({ error: 'Esta competición ya pertenece a otra liga' });
      }

      let nextOrder = order_index;
      if (nextOrder == null) {
        const { data: maxRow } = await supabase
          .from('league_competitions')
          .select('order_index')
          .eq('league_id', req.params.id)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        nextOrder = (maxRow?.order_index ?? -1) + 1;
      }

      const { data, error } = await supabase
        .from('league_competitions')
        .insert([
          {
            league_id: req.params.id,
            competition_id,
            order_index: nextOrder,
          },
        ])
        .select(`
          id,
          order_index,
          competition_id,
          competitions ( id, name, status, rounds, public_slug )
        `)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json({
        link_id: data.id,
        order_index: data.order_index,
        ...data.competitions,
      });
    } catch (error) {
      console.error('POST /leagues/:id/competitions:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.delete(
  '/:id/competitions/:compId',
  param('id').isUUID(),
  param('compId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const { error } = await supabase
        .from('league_competitions')
        .delete()
        .eq('league_id', req.params.id)
        .eq('competition_id', req.params.compId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /leagues/:id/competitions/:compId:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  '/:id/participants',
  param('id').isUUID(),
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('vehicle_id').optional({ values: 'falsy' }).isUUID(),
  body('vehicle_model').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const { name, email, vehicle_id, vehicle_model } = req.body;

      const insertData = {
        league_id: req.params.id,
        name: name.trim(),
        email: email ? String(email).trim().toLowerCase() : null,
        vehicle_id: vehicle_id || null,
        vehicle_model: vehicle_model ? String(vehicle_model).trim() : null,
        registered_by: req.user.id,
        status: 'confirmed',
      };

      const { data, error } = await supabase
        .from('league_participants')
        .insert([insertData])
        .select('*')
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('POST /leagues/:id/participants:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.delete(
  '/:id/participants/:participantId',
  param('id').isUUID(),
  param('participantId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const { error } = await supabase
        .from('league_participants')
        .delete()
        .eq('league_id', req.params.id)
        .eq('id', req.params.participantId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /leagues/:id/participants/:participantId:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  '/:id/competitions/:compId/sync-participants',
  param('id').isUUID(),
  param('compId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireManageLeague(supabase, req.user, req.params.id);
      if (!access.ok) return access.respond(res);

      const { data: link } = await supabase
        .from('league_competitions')
        .select('id')
        .eq('league_id', req.params.id)
        .eq('competition_id', req.params.compId)
        .maybeSingle();

      if (!link) {
        return res.status(404).json({ error: 'La competición no pertenece a esta liga' });
      }

      const { data: leagueParticipants, error: lpErr } = await supabase
        .from('league_participants')
        .select('*')
        .eq('league_id', req.params.id)
        .eq('status', 'confirmed');

      if (lpErr) {
        return res.status(500).json({ error: lpErr.message });
      }

      const { data: existingSignups } = await supabase
        .from('competition_signups')
        .select('name, email')
        .eq('competition_id', req.params.compId);

      const existingKeys = new Set(
        (existingSignups || []).map((s) =>
          `${String(s.name).trim().toLowerCase()}|${String(s.email || '').trim().toLowerCase()}`,
        ),
      );

      const toInsert = [];
      for (const lp of leagueParticipants || []) {
        const key = `${String(lp.name).trim().toLowerCase()}|${String(lp.email || '').trim().toLowerCase()}`;
        if (existingKeys.has(key)) continue;

        toInsert.push({
          competition_id: req.params.compId,
          name: lp.name,
          email: lp.email,
          vehicle: lp.vehicle_model || null,
          vehicle_id: lp.vehicle_id || null,
          is_waitlist: false,
        });
        existingKeys.add(key);
      }

      if (toInsert.length === 0) {
        return res.json({ created: 0, message: 'No hay participantes nuevos para sincronizar' });
      }

      const { data: created, error: insErr } = await supabase
        .from('competition_signups')
        .insert(toInsert)
        .select('id, name, email');

      if (insErr) {
        return res.status(500).json({ error: insErr.message });
      }

      res.json({ created: (created || []).length, signups: created || [] });
    } catch (error) {
      console.error('POST sync-participants:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.get('/:id/standings', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const access = await requireViewLeague(supabase, req.user, req.params.id);
    if (!access.ok) return access.respond(res);

    const result = await computeLeagueStandings(supabase, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('GET /leagues/:id/standings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
