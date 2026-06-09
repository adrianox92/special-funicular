const { calculatePoints } = require('./pointsCalculator');

/**
 * Clave estable para emparejar participantes entre pruebas de la liga.
 * @param {string|null|undefined} name
 * @param {string|null|undefined} email
 */
function participantMatchKey(name, email) {
  const n = String(name || '').trim().toLowerCase();
  const e = String(email || '').trim().toLowerCase();
  if (e) return `${n}|${e}`;
  return n;
}

/**
 * Registra un participante y sus alias (nombre solo / nombre+email) para emparejar
 * entradas aunque solo una de las fuentes tenga email.
 * @param {Map<string, object>} standingsMap
 * @param {Map<string, string>} keyAliases
 * @param {string} key
 * @param {object} row
 */
function registerStandingsEntry(standingsMap, keyAliases, key, row) {
  standingsMap.set(key, row);
  keyAliases.set(key, key);
  const nameKey = participantMatchKey(row.name, null);
  if (!keyAliases.has(nameKey)) {
    keyAliases.set(nameKey, key);
  }
  if (row.email) {
    keyAliases.set(participantMatchKey(row.name, row.email), key);
  }
}

/**
 * Resuelve la clave canónica de un participante en el mapa de clasificación.
 * @param {Map<string, string>} keyAliases
 * @param {Map<string, object>} standingsMap
 * @param {string|null|undefined} name
 * @param {string|null|undefined} email
 */
function resolveParticipantKey(keyAliases, standingsMap, name, email) {
  const candidates = [
    participantMatchKey(name, email),
    participantMatchKey(name, null),
  ];
  for (const candidate of candidates) {
    if (keyAliases.has(candidate)) return keyAliases.get(candidate);
    if (standingsMap.has(candidate)) return candidate;
  }
  return participantMatchKey(name, email);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} leagueId
 */
async function computeLeagueStandings(supabase, leagueId) {
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, name, slug, status, scoring_mode')
    .eq('id', leagueId)
    .maybeSingle();

  if (leagueErr || !league) {
    throw new Error('Liga no encontrada');
  }

  const { data: leagueCompRows, error: lcErr } = await supabase
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
        public_slug
      )
    `)
    .eq('league_id', leagueId)
    .order('order_index', { ascending: true });

  if (lcErr) {
    throw new Error(lcErr.message);
  }

  const competitions = (leagueCompRows || [])
    .map((row) => ({
      link_id: row.id,
      order_index: row.order_index,
      ...row.competitions,
    }))
    .filter((c) => c?.id);

  let leagueRules = [];
  if (league.scoring_mode === 'league_rules') {
    const { data: rules, error: rulesErr } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('league_id', leagueId)
      .eq('is_template', false)
      .order('rule_type', { ascending: true });

    if (rulesErr) {
      throw new Error(rulesErr.message);
    }
    leagueRules = rules || [];
  }

  const { data: leagueParticipants, error: lpErr } = await supabase
    .from('league_participants')
    .select('id, name, email, vehicle_id, vehicle_model, status')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true });

  if (lpErr) {
    throw new Error(lpErr.message);
  }

  const standingsMap = new Map();
  const keyAliases = new Map();
  for (const lp of leagueParticipants || []) {
    const key = participantMatchKey(lp.name, lp.email);
    registerStandingsEntry(standingsMap, keyAliases, key, {
      league_participant_id: lp.id,
      name: lp.name,
      email: lp.email || null,
      vehicle_model: lp.vehicle_model || null,
      status: lp.status,
      total_points: 0,
      competitions_completed: 0,
      by_competition: {},
    });
  }

  const competitionResults = [];

  for (const comp of competitions) {
    const compResult = {
      competition_id: comp.id,
      competition_name: comp.name,
      competition_status: comp.status,
      order_index: comp.order_index,
      public_slug: comp.public_slug,
      points_by_participant_key: {},
      has_results: false,
    };

    if (comp.status !== 'closed') {
      competitionResults.push(compResult);
      continue;
    }

    const { data: participants, error: partErr } = await supabase
      .from('competition_participants')
      .select(`
        id,
        driver_name,
        category_id,
        vehicle_model,
        team_name,
        vehicles ( manufacturer, model )
      `)
      .eq('competition_id', comp.id);

    if (partErr) {
      throw new Error(partErr.message);
    }

    const { data: timings, error: timingsErr } = await supabase
      .from('competition_timings')
      .select('*')
      .in(
        'participant_id',
        (participants || []).map((p) => p.id),
      );

    if (timingsErr) {
      throw new Error(timingsErr.message);
    }

    const { data: categories } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', comp.id);

    let rules = leagueRules;
    if (league.scoring_mode === 'per_competition') {
      const { data: compRules, error: compRulesErr } = await supabase
        .from('competition_rules')
        .select('*')
        .eq('competition_id', comp.id)
        .eq('is_template', false);

      if (compRulesErr) {
        throw new Error(compRulesErr.message);
      }
      rules = compRules || [];
    }

    const { data: signups } = await supabase
      .from('competition_signups')
      .select('name, email')
      .eq('competition_id', comp.id);

    const signupEmailByName = new Map();
    for (const s of signups || []) {
      const key = participantMatchKey(s.name, null);
      if (s.email && !signupEmailByName.has(key)) {
        signupEmailByName.set(key, s.email);
      }
    }

    const pointsResult = calculatePoints({
      competition: comp,
      participants: participants || [],
      timings: timings || [],
      rules,
      categories: categories || [],
    });

    compResult.has_results = (timings || []).length > 0;

    for (const stat of pointsResult.sortedParticipants) {
      const participant = (participants || []).find((p) => p.id === stat.participant_id);
      if (!participant) continue;

      const email = signupEmailByName.get(participantMatchKey(participant.driver_name, null)) || null;
      const key = resolveParticipantKey(keyAliases, standingsMap, participant.driver_name, email);
      const pts = stat.points || 0;

      compResult.points_by_participant_key[key] = {
        points: pts,
        position: stat.position,
        driver_name: participant.driver_name,
      };

      if (standingsMap.has(key)) {
        const row = standingsMap.get(key);
        if (!row.email && email) {
          row.email = email;
          keyAliases.set(participantMatchKey(participant.driver_name, email), key);
        }
        row.total_points += pts;
        row.by_competition[comp.id] = {
          competition_name: comp.name,
          points: pts,
          position: stat.position,
        };
        if (pts > 0 || (timings || []).some((t) => t.participant_id === participant.id)) {
          row.competitions_completed += 1;
        }
      } else {
        registerStandingsEntry(standingsMap, keyAliases, key, {
          league_participant_id: null,
          name: participant.driver_name,
          email,
          vehicle_model: participant.vehicle_model || null,
          status: null,
          total_points: pts,
          competitions_completed: 1,
          by_competition: {
            [comp.id]: {
              competition_name: comp.name,
              points: pts,
              position: stat.position,
            },
          },
        });
      }
    }

    competitionResults.push(compResult);
  }

  const standings = Array.from(standingsMap.values()).sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.competitions_completed !== a.competitions_completed) {
      return b.competitions_completed - a.competitions_completed;
    }
    return String(a.name).localeCompare(String(b.name), 'es');
  });

  standings.forEach((row, index) => {
    row.position = index + 1;
  });

  return {
    league,
    competitions: competitionResults,
    standings,
  };
}

module.exports = {
  participantMatchKey,
  registerStandingsEntry,
  resolveParticipantKey,
  computeLeagueStandings,
};
