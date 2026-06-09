const express = require('express');
const router = express.Router();
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const { computeLeagueStandings } = require('../lib/leagueStandings');

const supabase = getServiceOrAnonClient();

function isDraftLeague(league) {
  return league?.status === 'draft';
}

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: league, error } = await supabase
      .from('leagues')
      .select('id, name, slug, status, scoring_mode, club_id, created_at, clubs ( id, name, slug )')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !league) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    if (isDraftLeague(league)) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    const { data: leagueCompetitions } = await supabase
      .from('league_competitions')
      .select(`
        order_index,
        competitions ( id, name, status, public_slug, circuit_name )
      `)
      .eq('league_id', league.id)
      .order('order_index', { ascending: true });

    const { count: participantsCount } = await supabase
      .from('league_participants')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id)
      .eq('status', 'confirmed');

    res.json({
      ...league,
      club: league.clubs || null,
      competitions: (leagueCompetitions || []).map((row) => ({
        order_index: row.order_index,
        ...row.competitions,
      })),
      participants_count: participantsCount || 0,
    });
  } catch (error) {
    console.error('GET /public-leagues/:slug:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:slug/signup', async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, email, vehicle, vehicle_id } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const { data: league, error } = await supabase
      .from('leagues')
      .select('id, name, status')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !league || isDraftLeague(league)) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    if (league.status === 'closed') {
      return res.status(400).json({ error: 'La liga está cerrada y no acepta inscripciones' });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedName = String(name).trim();

    if (normalizedEmail) {
      const { data: existing } = await supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', league.id)
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: 'Ya existe una inscripción con este email' });
      }
    }

    const { data, error: insErr } = await supabase
      .from('league_participants')
      .insert([
        {
          league_id: league.id,
          name: normalizedName,
          email: normalizedEmail,
          vehicle_model: vehicle ? String(vehicle).trim() : null,
          vehicle_id: vehicle_id || null,
          status: 'confirmed',
        },
      ])
      .select('id, name, email, status, created_at')
      .single();

    if (insErr) {
      return res.status(500).json({ error: insErr.message });
    }

    res.status(201).json({
      message: 'Inscripción realizada correctamente',
      participant: data,
      league_name: league.name,
    });
  } catch (error) {
    console.error('POST /public-leagues/:slug/signup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/standings', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: league, error } = await supabase
      .from('leagues')
      .select('id, status')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !league || isDraftLeague(league)) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    const result = await computeLeagueStandings(supabase, league.id);
    res.json(result);
  } catch (error) {
    console.error('GET /public-leagues/:slug/standings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
