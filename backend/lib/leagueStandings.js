const { calculatePoints } = require('./pointsCalculator');

/**
 * Normaliza nombre de piloto para emparejar variantes (espacios, acentos).
 * @param {string|null|undefined} name
 */
function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Etiqueta legible del vehículo usado en una competición.
 * @param {{ vehicle_model?: string|null, vehicles?: { manufacturer?: string, model?: string }|null }} participant
 */
function formatParticipantVehicle(participant) {
  if (!participant) return null;
  if (participant.vehicles?.manufacturer || participant.vehicles?.model) {
    const label = [participant.vehicles.manufacturer, participant.vehicles.model]
      .filter(Boolean)
      .join(' ')
      .trim();
    return label || null;
  }
  const model = String(participant.vehicle_model || '').trim();
  return model || null;
}

/**
 * @param {number} points
 * @param {number} position
 * @param {string|null} vehicle
 */
function buildCompetitionStandingEntry(points, position, vehicle) {
  return {
    points,
    position,
    dropped: false,
    vehicle: vehicle || null,
  };
}

/**
 * Clave estable para emparejar participantes entre pruebas de la liga.
 * @param {string|null|undefined} name
 * @param {string|null|undefined} email
 */
function participantMatchKey(name, email) {
  const n = normalizeParticipantName(name);
  const e = String(email || '').trim().toLowerCase();
  if (e) return `${n}|${e}`;
  return n;
}

/**
 * Registra un participante y sus alias (nombre solo / nombre+email) para emparejar
 * entradas aunque solo una de las fuentes tenga email.
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
 * Aplica descarte de peores resultados y recalcula total_points.
 * @param {object} row
 * @param {number|null|undefined} countingRaces
 */
function applyCountingRaces(row, countingRaces) {
  const entries = Object.entries(row.by_competition || {});
  entries.forEach(([, r]) => {
    r.dropped = false;
  });

  if (!countingRaces || countingRaces <= 0 || entries.length <= countingRaces) {
    row.total_points = entries.reduce((s, [, r]) => s + (r.points || 0), 0);
    row.dropped_competitions = 0;
    row.competitions_completed = entries.filter(([, r]) => (r.points || 0) > 0).length;
    row.wins = entries.filter(([, r]) => r.position === 1).length;
    return;
  }

  const sortedWorstFirst = [...entries].sort(
    (a, b) => (a[1].points || 0) - (b[1].points || 0),
  );
  const dropCount = entries.length - countingRaces;
  const dropIds = new Set(sortedWorstFirst.slice(0, dropCount).map(([id]) => id));

  let total = 0;
  let completed = 0;
  let wins = 0;
  for (const [compId, r] of entries) {
    r.dropped = dropIds.has(compId);
    if (!r.dropped) {
      total += r.points || 0;
      if ((r.points || 0) > 0) completed += 1;
      if (r.position === 1) wins += 1;
    }
  }

  row.total_points = total;
  row.dropped_competitions = dropCount;
  row.competitions_completed = completed;
  row.wins = wins;
}

function getLastRacePosition(row, closedCompetitionIds) {
  for (let i = closedCompetitionIds.length - 1; i >= 0; i -= 1) {
    const compId = closedCompetitionIds[i];
    const entry = row.by_competition?.[compId];
    if (entry && !entry.dropped && entry.position != null) {
      return entry.position;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * @param {Array<object>} standings
 * @param {string} tiebreakMode
 * @param {string[]} closedCompetitionIds — ids ordenados por order_index
 */
function sortStandings(standings, tiebreakMode, closedCompetitionIds) {
  const mode = tiebreakMode || 'competitions_completed';

  return [...standings].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;

    if (mode === 'most_wins') {
      const winsA = a.wins || 0;
      const winsB = b.wins || 0;
      if (winsB !== winsA) return winsB - winsA;
    } else if (mode === 'last_race_position') {
      const posA = getLastRacePosition(a, closedCompetitionIds);
      const posB = getLastRacePosition(b, closedCompetitionIds);
      if (posA !== posB) return posA - posB;
    } else {
      if (b.competitions_completed !== a.competitions_completed) {
        return b.competitions_completed - a.competitions_completed;
      }
    }

    return String(a.name).localeCompare(String(b.name), 'es');
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} leagueId
 * @param {{ categoryId?: string }} [opts]
 */
async function computeLeagueStandings(supabase, leagueId, opts = {}) {
  const { categoryId } = opts;

  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, name, slug, status, scoring_mode, counting_races, tiebreak_mode')
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
      wins: 0,
      dropped_competitions: 0,
      by_competition: {},
    });
  }

  const competitionResults = [];
  const closedCompetitionIds = [];

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

    closedCompetitionIds.push(comp.id);

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

    const filteredParticipants = categoryId
      ? (participants || []).filter((p) => p.category_id === categoryId)
      : participants || [];

    const { data: timings, error: timingsErr } = await supabase
      .from('competition_timings')
      .select('*')
      .in(
        'participant_id',
        filteredParticipants.map((p) => p.id),
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
      participants: filteredParticipants,
      timings: timings || [],
      rules,
      categories: categories || [],
    });

    compResult.has_results = (timings || []).length > 0;

    for (const stat of pointsResult.sortedParticipants) {
      const participant = filteredParticipants.find((p) => p.id === stat.participant_id);
      if (!participant) continue;

      const email = signupEmailByName.get(participantMatchKey(participant.driver_name, null)) || null;
      const key = resolveParticipantKey(keyAliases, standingsMap, participant.driver_name, email);
      const pts = stat.points || 0;
      const vehicle = formatParticipantVehicle(participant);
      const compEntry = {
        ...buildCompetitionStandingEntry(pts, stat.position, vehicle),
        competition_name: comp.name,
      };

      compResult.points_by_participant_key[key] = {
        points: pts,
        position: stat.position,
        driver_name: participant.driver_name,
        vehicle,
      };

      if (standingsMap.has(key)) {
        const row = standingsMap.get(key);
        if (!row.email && email) {
          row.email = email;
          keyAliases.set(participantMatchKey(participant.driver_name, email), key);
        }
        row.by_competition[comp.id] = compEntry;
      } else {
        registerStandingsEntry(standingsMap, keyAliases, key, {
          league_participant_id: null,
          name: participant.driver_name,
          email,
          vehicle_model: participant.vehicle_model || null,
          status: null,
          total_points: 0,
          competitions_completed: 0,
          wins: 0,
          dropped_competitions: 0,
          by_competition: {
            [comp.id]: compEntry,
          },
        });
      }
    }

    competitionResults.push(compResult);
  }

  const rawStandings = Array.from(standingsMap.values());
  for (const row of rawStandings) {
    applyCountingRaces(row, league.counting_races);
  }

  const standings = sortStandings(rawStandings, league.tiebreak_mode, closedCompetitionIds);
  standings.forEach((row, index) => {
    row.position = index + 1;
  });

  return {
    league,
    competitions: competitionResults,
    standings,
    category_id: categoryId || null,
  };
}

module.exports = {
  normalizeParticipantName,
  formatParticipantVehicle,
  buildCompetitionStandingEntry,
  participantMatchKey,
  registerStandingsEntry,
  resolveParticipantKey,
  applyCountingRaces,
  sortStandings,
  computeLeagueStandings,
};
