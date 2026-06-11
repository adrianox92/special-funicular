const express = require('express');
const router = express.Router();
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const { computeLeagueStandings } = require('../lib/leagueStandings');
const { generateLeagueCSV, safeFilenamePart } = require('../lib/leagueCsvGenerator');
const { generateLeagueSocialPDF } = require('../src/utils/leagueSocialPdfGenerator');

const supabase = getServiceOrAnonClient();

function isDraftLeague(league) {
  return league?.status === 'draft';
}

async function getPublicLeagueBySlug(slug) {
  const { data: league, error } = await supabase
    .from('leagues')
    .select('id, name, slug, status, scoring_mode, club_id, max_participants, counting_races, created_at, clubs ( id, name, slug )')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !league || isDraftLeague(league)) {
    return null;
  }
  return league;
}

router.get('/:slug', async (req, res) => {
  try {
    const league = await getPublicLeagueBySlug(req.params.slug);
    if (!league) {
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

    const { count: waitlistCount } = await supabase
      .from('league_participants')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id)
      .eq('status', 'waitlist');

    res.json({
      ...league,
      club: league.clubs || null,
      competitions: (leagueCompetitions || []).map((row) => ({
        order_index: row.order_index,
        ...row.competitions,
      })),
      participants_count: participantsCount || 0,
      waitlist_count: waitlistCount || 0,
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

    const league = await getPublicLeagueBySlug(slug);
    if (!league) {
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

    let status = 'confirmed';
    let waitlistPosition = null;

    if (league.max_participants) {
      const { count: confirmedCount } = await supabase
        .from('league_participants')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', league.id)
        .eq('status', 'confirmed');

      if ((confirmedCount || 0) >= league.max_participants) {
        status = 'waitlist';
        const { count: waitlistCount } = await supabase
          .from('league_participants')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id)
          .eq('status', 'waitlist');
        waitlistPosition = (waitlistCount || 0) + 1;
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
          status,
        },
      ])
      .select('id, name, email, status, created_at')
      .single();

    if (insErr) {
      return res.status(500).json({ error: insErr.message });
    }

    res.status(201).json({
      message: status === 'waitlist'
        ? 'Te has unido a la lista de espera'
        : 'Inscripción realizada correctamente',
      waitlisted: status === 'waitlist',
      waitlist_position: waitlistPosition,
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
    const league = await getPublicLeagueBySlug(req.params.slug);
    if (!league) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    const result = await computeLeagueStandings(supabase, league.id, {
      categoryId: req.query.category_id || undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('GET /public-leagues/:slug/standings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/export/csv', async (req, res) => {
  try {
    const league = await getPublicLeagueBySlug(req.params.slug);
    if (!league) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    const payload = await computeLeagueStandings(supabase, league.id);
    const csvData = generateLeagueCSV(payload);
    const base = safeFilenamePart(payload.league.name);
    const day = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=liga_${base}_${day}.csv`);
    res.send(csvData);
  } catch (error) {
    console.error('GET /public-leagues/:slug/export/csv:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/export/social', async (req, res) => {
  try {
    const league = await getPublicLeagueBySlug(req.params.slug);
    if (!league) {
      return res.status(404).json({ error: 'Liga no encontrada' });
    }

    const payload = await computeLeagueStandings(supabase, league.id);

    let clubName = null;
    if (league.club_id) {
      const { data: clubRow } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', league.club_id)
        .maybeSingle();
      clubName = clubRow?.name || league.clubs?.name || null;
    }

    const pdfBuffer = await generateLeagueSocialPDF(payload.league, {
      standings: payload.standings,
      clubName,
    });

    const base = safeFilenamePart(payload.league.name);
    const day = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=liga_${base}_social_${day}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('GET /public-leagues/:slug/export/social:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
