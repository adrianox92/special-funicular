const isLeagueCompetitionVisible = (comp) =>
  comp?.competition_status === 'closed' ||
  ((comp?.competition_status === 'running' || comp?.competition_status === 'published') &&
    Boolean(comp?.has_results));

export function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e || null;
}

export function findStandingRow(standings, matcher = {}) {
  const list = Array.isArray(standings) ? standings : [];
  const participantId = matcher.leagueParticipantId || matcher.league_participant_id || null;
  if (participantId) {
    const byId = list.find((row) => row.league_participant_id === participantId);
    if (byId) return byId;
  }

  const email = normalizeEmail(matcher.email);
  if (email) {
    const byEmail = list.find((row) => normalizeEmail(row.email) === email);
    if (byEmail) return byEmail;
  }

  if (matcher.name) {
    const name = normalizeParticipantName(matcher.name);
    if (name) {
      const matches = list.filter((row) => normalizeParticipantName(row.name) === name);
      if (matches.length === 1) return matches[0];
      if (email) {
        return matches.find((row) => normalizeEmail(row.email) === email) || null;
      }
    }
  }

  return null;
}

export function viewerMatcher(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    email: user.email || null,
    name: meta.full_name || meta.name || null,
  };
}

export function isSelfStanding(row, user) {
  if (!row || !user) return false;
  const email = normalizeEmail(user.email);
  return Boolean(email && normalizeEmail(row.email) === email);
}

export function findMyStandingRow(standings, user) {
  const matcher = viewerMatcher(user);
  if (!matcher) return null;
  return findStandingRow(standings, matcher);
}

export function raceAppearance(comp, entry) {
  const scored = isLeagueCompetitionVisible(comp);
  if (!scored) return 'pending';
  if (!entry) return 'absent';
  const status = String(entry.result_status || '').toLowerCase();
  if (status === 'dns') return 'dns';
  if (status === 'dsq') return 'dsq';
  return 'result';
}

export function competitionPublicPath(comp) {
  const slug = comp?.public_slug;
  if (!slug) return null;
  return `/competitions/signup/${slug}`;
}

function buildRaceRow(comp, entry) {
  const scored = isLeagueCompetitionVisible(comp);
  const appearance = raceAppearance(comp, entry);
  const dropped = Boolean(entry?.dropped);
  const hasEntry = Boolean(entry);
  const points = hasEntry ? Number(entry.points) || 0 : null;

  return {
    competition_id: comp.competition_id || comp.id,
    competition_name: comp.competition_name || comp.name || entry?.competition_name || null,
    competition_status: comp.competition_status || comp.status || null,
    order_index: comp.order_index,
    public_slug: comp.public_slug || null,
    has_results: Boolean(comp.has_results),
    scored,
    appearance,
    points,
    position: hasEntry && entry.position != null ? entry.position : null,
    dropped,
    counts: Boolean(scored && hasEntry && !dropped),
    vehicle: entry?.vehicle || null,
    power_stage_points: hasEntry ? Number(entry.power_stage_points) || 0 : 0,
    result_status: entry?.result_status || null,
    result_status_source: entry?.result_status_source || null,
    public_path: competitionPublicPath(comp),
  };
}

function emptyReasonForSeason(competitions, races, row) {
  if (!competitions.length) return 'no_competitions';
  const hasAnyEntry = Boolean(row && Object.keys(row.by_competition || {}).length);
  if (!hasAnyEntry) return 'no_results';
  if (races.every((race) => race.appearance === 'pending' || race.appearance === 'absent')) {
    return 'no_results';
  }
  return null;
}

/**
 * Proyecta la ficha “Mi temporada” desde un payload de standings ya calculado.
 * No recalcula puntos ni descartes.
 */
export function buildParticipantSeason(payload, matcher = {}, opts = {}) {
  const league = payload?.league || {};
  const competitions = Array.isArray(payload?.competitions) ? payload.competitions : [];
  const standings = Array.isArray(payload?.standings) ? payload.standings : [];
  const row = findStandingRow(standings, matcher);
  const viewer = opts.viewer || null;
  const isSelf = opts.isSelf != null ? Boolean(opts.isSelf) : isSelfStanding(row, viewer);
  const includeEmail = opts.includeEmail != null ? Boolean(opts.includeEmail) : Boolean(isSelf);

  if (!row) {
    return {
      found: false,
      is_self: false,
      participant: null,
      position: null,
      total_points: 0,
      competitions_completed: 0,
      wins: 0,
      dropped_competitions: 0,
      counting_races: league.counting_races ?? null,
      league: {
        id: league.id || null,
        name: league.name || null,
        slug: league.slug || null,
        status: league.status || null,
        counting_races: league.counting_races ?? null,
        tiebreak_mode: league.tiebreak_mode || null,
      },
      races: [],
      counting: [],
      dropped: [],
      empty_reason: competitions.length ? 'not_found' : 'no_competitions',
    };
  }

  const races = competitions.map((comp) => {
    const id = comp.competition_id || comp.id;
    return buildRaceRow(comp, row.by_competition?.[id] || null);
  });

  const counting = races.filter((race) => race.counts);
  const dropped = races.filter((race) => race.dropped);

  return {
    found: true,
    is_self: isSelf,
    participant: {
      league_participant_id: row.league_participant_id || null,
      name: row.name,
      email: includeEmail ? row.email || null : null,
      vehicle_model: row.vehicle_model || null,
      status: row.status || null,
    },
    position: row.position ?? null,
    total_points: Number(row.total_points) || 0,
    competitions_completed: Number(row.competitions_completed) || 0,
    wins: Number(row.wins) || 0,
    dropped_competitions: Number(row.dropped_competitions) || dropped.length,
    counting_races: league.counting_races ?? null,
    league: {
      id: league.id || null,
      name: league.name || null,
      slug: league.slug || null,
      status: league.status || null,
      counting_races: league.counting_races ?? null,
      tiebreak_mode: league.tiebreak_mode || null,
    },
    races,
    counting,
    dropped,
    empty_reason: emptyReasonForSeason(competitions, races, row),
  };
}

export function participantKeyFromRow(row) {
  if (!row) return null;
  if (row.league_participant_id) return row.league_participant_id;
  if (row.name) return `name:${row.name}`;
  return null;
}

export function matcherFromParticipantKey(key) {
  if (!key) return {};
  if (String(key).startsWith('name:')) {
    return { name: String(key).slice(5) };
  }
  return { leagueParticipantId: key };
}
