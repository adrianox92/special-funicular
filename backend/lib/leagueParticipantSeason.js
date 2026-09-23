'use strict';

const {
  normalizeParticipantName,
  isLeagueCompetitionVisibleInStandings,
} = require('./leagueStandings');

function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e || null;
}

/**
 * Localiza la fila de clasificación del piloto (sin recalcular puntos).
 * @param {Array<object>} standings
 * @param {{ leagueParticipantId?: string|null, name?: string|null, email?: string|null }} [matcher]
 */
function findStandingRow(standings, matcher = {}) {
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

function viewerMatcher(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    email: user.email || null,
    name: meta.full_name || meta.name || null,
  };
}

function isSelfStanding(row, user) {
  if (!row || !user) return false;
  const email = normalizeEmail(user.email);
  if (email && normalizeEmail(row.email) === email) return true;
  const matcher = viewerMatcher(user);
  if (matcher?.name && normalizeParticipantName(row.name) === normalizeParticipantName(matcher.name)) {
    return Boolean(email && normalizeEmail(row.email) === email);
  }
  return false;
}

/**
 * Resuelve “yo” contra inscritos de liga (email o registered_by) y la clasificación.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} leagueId
 * @param {object} user
 */
async function resolveMyMatcher(supabase, leagueId, user) {
  const fallback = viewerMatcher(user) || {};
  if (!supabase || !leagueId || !user?.id) return fallback;

  const { data, error } = await supabase
    .from('league_participants')
    .select('id, name, email, registered_by')
    .eq('league_id', leagueId);

  if (error || !data?.length) return fallback;

  const email = normalizeEmail(user.email);
  const byEmail = email
    ? data.find((p) => normalizeEmail(p.email) === email)
    : null;
  const byRegistered = data.find((p) => p.registered_by === user.id);
  const hit = byEmail || byRegistered;
  if (!hit) return fallback;

  return {
    leagueParticipantId: hit.id,
    name: hit.name,
    email: hit.email || fallback.email || null,
  };
}

function raceAppearance(comp, entry) {
  const scored = isLeagueCompetitionVisibleInStandings(comp);
  if (!scored) return 'pending';
  if (!entry) return 'absent';
  const status = String(entry.result_status || '').toLowerCase();
  if (status === 'dns') return 'dns';
  if (status === 'dsq') return 'dsq';
  return 'result';
}

function competitionPublicPath(comp) {
  const slug = comp?.public_slug;
  if (!slug) return null;
  return `/competitions/signup/${slug}`;
}

function buildRaceRow(comp, entry) {
  const scored = isLeagueCompetitionVisibleInStandings(comp);
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
    overridden: Boolean(entry?.overridden),
    override: entry?.override || null,
    points_source: entry?.points_source || null,
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

function publicParticipant(row, { includeEmail }) {
  if (!row) return null;
  return {
    league_participant_id: row.league_participant_id || null,
    name: row.name,
    email: includeEmail ? row.email || null : null,
    vehicle_model: row.vehicle_model || null,
    status: row.status || null,
  };
}

/**
 * Ficha piloto-centrada a partir de un payload de `computeLeagueStandings`.
 * No recalcula puntos ni descartes: solo proyecta la fila ya calculada.
 *
 * @param {{ league?: object, competitions?: Array<object>, standings?: Array<object> }} payload
 * @param {{ leagueParticipantId?: string, name?: string, email?: string }} matcher
 * @param {{ includeEmail?: boolean, isSelf?: boolean, viewer?: object }} [opts]
 */
function buildParticipantSeason(payload, matcher = {}, opts = {}) {
  const league = payload?.league || {};
  const competitions = Array.isArray(payload?.competitions) ? payload.competitions : [];
  const standings = Array.isArray(payload?.standings) ? payload.standings : [];
  const row = findStandingRow(standings, matcher);
  const viewer = opts.viewer || null;
  const isSelf = opts.isSelf != null ? Boolean(opts.isSelf) : isSelfStanding(row, viewer);
  const includeEmail = opts.includeEmail != null
    ? Boolean(opts.includeEmail)
    : Boolean(isSelf);

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
    participant: publicParticipant(row, { includeEmail }),
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

module.exports = {
  normalizeEmail,
  findStandingRow,
  viewerMatcher,
  isSelfStanding,
  resolveMyMatcher,
  raceAppearance,
  competitionPublicPath,
  buildParticipantSeason,
};
