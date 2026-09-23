'use strict';

const {
  participantMatchKey,
  registerStandingsEntry,
  resolveParticipantKey,
} = require('./leagueStandings');
const { deriveCompetitionAverageFromTotalAndLaps } = require('./competitionTimingDerivation');
const { promoteCompetitionToRunningOnFirstTiming } = require('./competitionLifecycle');

/**
 * Regla G1 al sincronizar desde sesiones de timing:
 * no se inventan filas DNS/DSQ ni inscritos de liga para sesiones sin match.
 * Un inscrito de liga sin sesión queda “no figura” (sin descarte).
 * DNS/DSQ se marcan a mano en la clasificación.
 */
const DNS_SYNC_RULE = Object.freeze({
  id: 'no_auto_dns',
  summary:
    'El sync no crea DNS ni participantes de liga para sesiones sin match. '
    + 'Un inscrito de liga sin sesión queda “no figura” (no consume descarte). '
    + 'DNS/DSQ se marcan a mano en la clasificación.',
});

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

function emailsEqual(a, b) {
  const left = normalizeEmail(a);
  const right = normalizeEmail(b);
  return Boolean(left && right && left === right);
}

function overrideCellKey(competitionId, leagueParticipantId) {
  return `${competitionId}:${leagueParticipantId}`;
}

/**
 * Empareja un candidato de timing con la lista de pilotos.
 * Prioridad: vehículo → email → nombre normalizado.
 */
function matchPilot(pilots, { email, name, vehicleId } = {}) {
  const list = pilots || [];
  if (vehicleId) {
    const byVehicle = list.find((pilot) => (pilot.vehicle_ids || []).includes(vehicleId));
    if (byVehicle) return { pilot: byVehicle, reason: 'vehicle' };
  }
  if (email) {
    const byEmail = list.find((pilot) => emailsEqual(pilot.email, email));
    if (byEmail) return { pilot: byEmail, reason: 'email' };
  }
  if (name) {
    const nameKey = participantMatchKey(name, null);
    const byName = list.find((pilot) => participantMatchKey(pilot.name, null) === nameKey);
    if (byName) return { pilot: byName, reason: 'name' };
  }
  return { pilot: null, reason: null };
}

function sessionRank(session, { circuitId } = {}) {
  let score = 0;
  const sessionType = String(session?.session_type || '').toUpperCase();
  if (sessionType === 'HEAT') score += 100;
  else if (sessionType === 'TRAINING') score += 10;
  if (circuitId && session?.circuit_id === circuitId) score += 50;
  return score;
}

function sessionTimeKey(session) {
  return `${session?.timing_date || ''}|${session?.created_at || ''}|${session?.id || ''}`;
}

function sessionHasUsableTime(session) {
  if (!session?.id) return false;
  const laps = Number(session.laps);
  if (!Number.isFinite(laps) || laps <= 0) return false;
  return Boolean(session.best_lap_time && session.total_time);
}

/**
 * Elige hasta `maxRounds` sesiones (HEAT y mismo circuito primero) y las
 * asigna a rondas en orden cronológico.
 */
function pickSessionsForPilot(sessions, { maxRounds = 1, circuitId } = {}) {
  const usable = (sessions || []).filter(sessionHasUsableTime);
  const ranked = [...usable].sort((a, b) => {
    const rankDiff = sessionRank(b, { circuitId }) - sessionRank(a, { circuitId });
    if (rankDiff) return rankDiff;
    return sessionTimeKey(b).localeCompare(sessionTimeKey(a));
  });
  const limit = Math.max(1, Number(maxRounds) || 1);
  const selected = ranked.slice(0, limit);
  selected.sort((a, b) => sessionTimeKey(a).localeCompare(sessionTimeKey(b)));
  return selected.map((session, index) => ({
    session,
    round_number: index + 1,
  }));
}

function sessionBelongsToPilot(session, pilot) {
  if ((pilot.vehicle_ids || []).includes(session.vehicle_id)) return 'vehicle';
  if (session.owner_email && emailsEqual(session.owner_email, pilot.email)) return 'email';
  if (
    session.owner_name
    && participantMatchKey(session.owner_name, null) === participantMatchKey(pilot.name, null)
  ) {
    return 'name';
  }
  return null;
}

function mergeLeagueAndCompetitionPilots({
  leagueParticipants = [],
  competitionParticipants = [],
  signups = [],
} = {}) {
  const signupEmailByName = new Map();
  for (const signup of signups) {
    const nameKey = participantMatchKey(signup.name, null);
    if (signup.email && !signupEmailByName.has(nameKey)) {
      signupEmailByName.set(nameKey, normalizeEmail(signup.email));
    }
  }

  const byKey = new Map();
  const keyAliases = new Map();

  for (const leagueParticipant of leagueParticipants) {
    if (leagueParticipant.status && leagueParticipant.status !== 'confirmed') continue;
    const email = normalizeEmail(leagueParticipant.email);
    const key = resolveParticipantKey(keyAliases, byKey, leagueParticipant.name, email);
    if (byKey.has(key)) continue;
    registerStandingsEntry(byKey, keyAliases, key, {
      name: leagueParticipant.name,
      email,
      league_participant_id: leagueParticipant.id,
      competition_participant_id: null,
      vehicle_ids: [leagueParticipant.vehicle_id].filter(Boolean),
      vehicle_model: leagueParticipant.vehicle_model || null,
      status: leagueParticipant.status || 'confirmed',
    });
  }

  for (const participant of competitionParticipants) {
    const email = signupEmailByName.get(participantMatchKey(participant.driver_name, null)) || null;
    const key = resolveParticipantKey(keyAliases, byKey, participant.driver_name, email);
    if (byKey.has(key)) {
      const row = byKey.get(key);
      row.competition_participant_id = participant.id;
      if (participant.vehicle_id && !row.vehicle_ids.includes(participant.vehicle_id)) {
        row.vehicle_ids.push(participant.vehicle_id);
      }
      if (!row.email && email) row.email = email;
      if (!row.vehicle_model && participant.vehicle_model) {
        row.vehicle_model = participant.vehicle_model;
      }
      continue;
    }

    registerStandingsEntry(byKey, keyAliases, key, {
      name: participant.driver_name,
      email,
      league_participant_id: null,
      competition_participant_id: participant.id,
      vehicle_ids: [participant.vehicle_id].filter(Boolean),
      vehicle_model: participant.vehicle_model || null,
      status: null,
    });
  }

  return Array.from(byKey.values());
}

function buildOverrideSet(overrides, competitionId) {
  return new Set(
    (overrides || [])
      .filter((row) => row.league_participant_id && row.competition_id === competitionId)
      .map((row) => overrideCellKey(row.competition_id, row.league_participant_id)),
  );
}

function publicRoundView(round) {
  return {
    session_id: round.session_id,
    round_number: round.round_number,
    best_lap_time: round.best_lap_time,
    total_time: round.total_time,
    laps: round.laps,
    timing_date: round.timing_date,
    session_type: round.session_type,
  };
}

function publicMatchedView(entry) {
  return {
    name: entry.name,
    email: entry.email,
    league_participant_id: entry.league_participant_id,
    competition_participant_id: entry.competition_participant_id,
    vehicle_id: entry.vehicle_id,
    match_reason: entry.match_reason,
    has_override: entry.has_override,
    rounds: (entry.rounds || []).map(publicRoundView),
  };
}

function buildSyncPlan({
  pilots = [],
  sessions = [],
  overrides = [],
  competitionId,
  maxRounds = 1,
  circuitId = null,
} = {}) {
  const overrideSet = buildOverrideSet(overrides, competitionId);
  const usedSessionIds = new Set();
  const matched = [];

  for (const pilot of pilots) {
    const ownSessions = [];
    let matchReason = null;
    for (const session of sessions) {
      if (usedSessionIds.has(session.id)) continue;
      const reason = sessionBelongsToPilot(session, pilot);
      if (!reason) continue;
      if (!matchReason) matchReason = reason;
      ownSessions.push(session);
    }

    const picks = pickSessionsForPilot(ownSessions, { maxRounds, circuitId });
    if (!picks.length) continue;

    picks.forEach((pick) => usedSessionIds.add(pick.session.id));

    const hasOverride = Boolean(
      pilot.league_participant_id
      && overrideSet.has(overrideCellKey(competitionId, pilot.league_participant_id)),
    );

    matched.push({
      name: pilot.name,
      email: pilot.email || null,
      league_participant_id: pilot.league_participant_id || null,
      competition_participant_id: pilot.competition_participant_id || null,
      vehicle_id: picks[0].session.vehicle_id || (pilot.vehicle_ids || [])[0] || null,
      vehicle_model: pilot.vehicle_model || null,
      match_reason: matchReason,
      has_override: hasOverride,
      rounds: picks.map((pick) => ({
        session_id: pick.session.id,
        round_number: pick.round_number,
        best_lap_time: pick.session.best_lap_time,
        total_time: pick.session.total_time,
        laps: pick.session.laps,
        timing_date: pick.session.timing_date || null,
        session_type: pick.session.session_type || null,
        session: pick.session,
      })),
    });
  }

  const unmatchedSessions = sessions
    .filter((session) => session?.id && !usedSessionIds.has(session.id))
    .map((session) => ({
      session_id: session.id,
      vehicle_id: session.vehicle_id || null,
      timing_date: session.timing_date || null,
      session_type: session.session_type || null,
      owner_name: session.owner_name || null,
      owner_email: session.owner_email || null,
    }));

  const matchedKeys = new Set(
    matched.map((row) => row.league_participant_id || `comp:${row.competition_participant_id}`),
  );
  const unmatchedParticipants = pilots
    .filter((pilot) => {
      const key = pilot.league_participant_id || `comp:${pilot.competition_participant_id}`;
      return !matchedKeys.has(key);
    })
    .map((pilot) => ({
      name: pilot.name,
      email: pilot.email || null,
      league_participant_id: pilot.league_participant_id || null,
      competition_participant_id: pilot.competition_participant_id || null,
    }));

  const skippedOverrides = matched.filter((row) => row.has_override);

  let emptyReason = null;
  if (!sessions.length) emptyReason = 'no_sessions';
  else if (!matched.length) emptyReason = 'no_matches';

  return {
    matched,
    skipped_overrides: skippedOverrides,
    unmatched_sessions: unmatchedSessions,
    unmatched_participants: unmatchedParticipants,
    dns_rule: DNS_SYNC_RULE,
    empty_reason: emptyReason,
  };
}

function summarizePlan(plan) {
  return {
    matched_count: (plan.matched || []).length,
    unmatched_session_count: (plan.unmatched_sessions || []).length,
    unmatched_participant_count: (plan.unmatched_participants || []).length,
    skipped_override_count: (plan.skipped_overrides || []).length,
    empty_reason: plan.empty_reason || null,
    dns_rule: plan.dns_rule || DNS_SYNC_RULE,
  };
}

function filterPlanBySessionIds(plan, sessionIds) {
  if (!sessionIds) return plan;
  const allowed = new Set((sessionIds || []).filter(Boolean));
  if (allowed.size === 0) return plan;

  const matched = [];
  for (const entry of plan.matched || []) {
    const rounds = (entry.rounds || []).filter((round) => allowed.has(round.session_id));
    if (!rounds.length) continue;
    matched.push({
      ...entry,
      rounds: rounds.map((round, index) => ({ ...round, round_number: index + 1 })),
    });
  }

  return {
    ...plan,
    matched,
    skipped_overrides: matched.filter((row) => row.has_override),
    empty_reason: matched.length ? null : 'no_matches',
  };
}

function buildCompetitionTimingPayload(session, participantId, roundNumber) {
  const derived = deriveCompetitionAverageFromTotalAndLaps(session.total_time, session.laps)
    || (
      session.average_time
        ? {
          average_time: session.average_time,
          average_time_timestamp: session.average_time_timestamp || null,
        }
        : null
    );

  if (!derived) {
    return { error: 'invalid_time' };
  }

  const payload = {
    participant_id: participantId,
    did_not_participate: false,
    best_lap_time: session.best_lap_time,
    total_time: session.total_time,
    laps: session.laps,
    average_time: derived.average_time,
    average_time_timestamp: derived.average_time_timestamp,
    round_number: roundNumber,
    timing_date: session.timing_date || new Date().toISOString().split('T')[0],
  };

  if (session.lane != null) payload.lane = session.lane;
  if (session.best_lap_timestamp != null) payload.best_lap_timestamp = session.best_lap_timestamp;
  if (session.total_time_timestamp != null) payload.total_time_timestamp = session.total_time_timestamp;
  if (session.circuit_id) payload.circuit_id = session.circuit_id;
  if (session.circuit) payload.circuit = session.circuit;
  if (session.setup_snapshot) payload.setup_snapshot = session.setup_snapshot;

  return { data: payload };
}

function isMissingRelationError(error) {
  const message = String(error?.message || error || '');
  return /does not exist|schema cache|could not find the table/i.test(message);
}

async function loadPointOverrides(supabase, leagueId, competitionId) {
  const { data, error } = await supabase
    .from('league_point_overrides')
    .select('competition_id, league_participant_id, points')
    .eq('league_id', leagueId)
    .eq('competition_id', competitionId);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return data || [];
}

function publicPlanView(plan) {
  return {
    matched: (plan.matched || []).map(publicMatchedView),
    unmatched_sessions: plan.unmatched_sessions || [],
    unmatched_participants: plan.unmatched_participants || [],
    skipped_overrides: (plan.skipped_overrides || []).map((row) => ({
      name: row.name,
      email: row.email,
      league_participant_id: row.league_participant_id,
      points: row.override_points ?? null,
    })),
    ...summarizePlan(plan),
  };
}

async function loadSyncContext(supabase, leagueId, competitionId) {
  const { data: link, error: linkErr } = await supabase
    .from('league_competitions')
    .select('id')
    .eq('league_id', leagueId)
    .eq('competition_id', competitionId)
    .maybeSingle();

  if (linkErr) throw new Error(linkErr.message);
  if (!link) {
    const error = new Error('La competición no pertenece a esta liga');
    error.status = 404;
    throw error;
  }

  const { data: competition, error: compErr } = await supabase
    .from('competitions')
    .select('id, name, status, rounds, circuit_id, circuit_name, organizer')
    .eq('id', competitionId)
    .maybeSingle();

  if (compErr) throw new Error(compErr.message);
  if (!competition) {
    const error = new Error('Competición no encontrada');
    error.status = 404;
    throw error;
  }

  const { data: leagueParticipants, error: lpErr } = await supabase
    .from('league_participants')
    .select('id, name, email, vehicle_id, vehicle_model, status')
    .eq('league_id', leagueId);

  if (lpErr) throw new Error(lpErr.message);

  const { data: competitionParticipants, error: cpErr } = await supabase
    .from('competition_participants')
    .select('id, driver_name, vehicle_id, vehicle_model')
    .eq('competition_id', competitionId);

  if (cpErr) throw new Error(cpErr.message);

  const { data: signups, error: signupErr } = await supabase
    .from('competition_signups')
    .select('name, email')
    .eq('competition_id', competitionId);

  if (signupErr) throw new Error(signupErr.message);

  const pilots = mergeLeagueAndCompetitionPilots({
    leagueParticipants: leagueParticipants || [],
    competitionParticipants: competitionParticipants || [],
    signups: signups || [],
  });

  const vehicleIds = [...new Set(pilots.flatMap((pilot) => pilot.vehicle_ids || []))];
  let sessions = [];
  if (vehicleIds.length > 0) {
    const { data: timingRows, error: timingErr } = await supabase
      .from('vehicle_timings')
      .select(`
        id,
        vehicle_id,
        best_lap_time,
        total_time,
        laps,
        average_time,
        average_time_timestamp,
        best_lap_timestamp,
        total_time_timestamp,
        lane,
        circuit,
        circuit_id,
        timing_date,
        session_type,
        setup_snapshot,
        created_at
      `)
      .in('vehicle_id', vehicleIds)
      .order('timing_date', { ascending: false })
      .limit(500);

    if (timingErr) throw new Error(timingErr.message);
    sessions = timingRows || [];
  }

  const overrides = await loadPointOverrides(supabase, leagueId, competitionId);
  const plan = buildSyncPlan({
    pilots,
    sessions,
    overrides,
    competitionId,
    maxRounds: competition.rounds || 1,
    circuitId: competition.circuit_id || null,
  });

  if (!vehicleIds.length && !plan.empty_reason) {
    plan.empty_reason = 'no_vehicles';
  } else if (!vehicleIds.length && !sessions.length) {
    plan.empty_reason = 'no_vehicles';
  }

  const overridePoints = new Map(
    (overrides || []).map((row) => [
      overrideCellKey(row.competition_id, row.league_participant_id),
      row.points,
    ]),
  );
  for (const row of plan.skipped_overrides) {
    row.override_points = overridePoints.get(
      overrideCellKey(competitionId, row.league_participant_id),
    ) ?? null;
  }

  return { competition, pilots, sessions, overrides, plan };
}

function toApiPreview({ leagueId, competition, plan }) {
  return {
    league_id: leagueId,
    competition_id: competition.id,
    competition_name: competition.name,
    competition_status: competition.status,
    sessions_found: (plan.matched || []).reduce(
      (sum, row) => sum + (row.rounds || []).length,
      0,
    ) + (plan.unmatched_sessions || []).length,
    ...publicPlanView(plan),
    applied: false,
  };
}

async function previewLeagueTimingSync(supabase, leagueId, competitionId) {
  const ctx = await loadSyncContext(supabase, leagueId, competitionId);
  return toApiPreview({ leagueId, competition: ctx.competition, plan: ctx.plan });
}

async function ensureCompetitionParticipant(supabase, competitionId, entry) {
  if (entry.competition_participant_id) {
    return { id: entry.competition_participant_id, created: false };
  }

  const participantData = {
    competition_id: competitionId,
    driver_name: entry.name,
  };
  if (entry.vehicle_id) participantData.vehicle_id = entry.vehicle_id;
  else if (entry.vehicle_model) participantData.vehicle_model = entry.vehicle_model;
  else {
    const error = new Error(`No se puede crear el participante ${entry.name} sin vehículo`);
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from('competition_participants')
    .insert([participantData])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, created: true };
}

async function upsertCompetitionTiming(supabase, payload) {
  const { data: existing, error: existingErr } = await supabase
    .from('competition_timings')
    .select('id')
    .eq('participant_id', payload.participant_id)
    .eq('round_number', payload.round_number)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (existing?.id) {
    const { data, error } = await supabase
      .from('competition_timings')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id, created: false };
  }

  const { data, error } = await supabase
    .from('competition_timings')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, created: true };
}

/**
 * Aplica el plan: escribe/actualiza `competition_timings` (lo que lee la liga).
 * No toca `league_point_overrides` ni crea DNS para no emparejados.
 */
async function applyLeagueTimingSync(supabase, leagueId, competitionId, opts = {}) {
  const ctx = await loadSyncContext(supabase, leagueId, competitionId);
  const plan = filterPlanBySessionIds(ctx.plan, opts.sessionIds);
  const preview = toApiPreview({ leagueId, competition: ctx.competition, plan });

  if (!plan.matched.length) {
    return {
      ...preview,
      applied: false,
      written: {
        created_timings: 0,
        updated_timings: 0,
        created_participants: 0,
      },
    };
  }

  let timingsBefore = 0;
  const existingParticipantIds = (ctx.pilots || [])
    .map((pilot) => pilot.competition_participant_id)
    .filter(Boolean);
  if (existingParticipantIds.length > 0) {
    const { count } = await supabase
      .from('competition_timings')
      .select('*', { count: 'exact', head: true })
      .in('participant_id', existingParticipantIds);
    timingsBefore = count || 0;
  }

  let createdTimings = 0;
  let updatedTimings = 0;
  let createdParticipants = 0;

  for (const entry of plan.matched) {
    const participant = await ensureCompetitionParticipant(supabase, competitionId, entry);
    if (participant.created) createdParticipants += 1;

    for (const round of entry.rounds) {
      const built = buildCompetitionTimingPayload(
        round.session,
        participant.id,
        round.round_number,
      );
      if (built.error) {
        const error = new Error(`Sesión ${round.session_id} con tiempo inválido`);
        error.status = 400;
        throw error;
      }
      const written = await upsertCompetitionTiming(supabase, built.data);
      if (written.created) createdTimings += 1;
      else updatedTimings += 1;
    }
  }

  if (createdTimings > 0) {
    await promoteCompetitionToRunningOnFirstTiming(
      supabase,
      competitionId,
      ctx.competition.status,
      timingsBefore,
    );
  }

  return {
    ...preview,
    applied: true,
    written: {
      created_timings: createdTimings,
      updated_timings: updatedTimings,
      created_participants: createdParticipants,
    },
  };
}

module.exports = {
  DNS_SYNC_RULE,
  normalizeEmail,
  emailsEqual,
  matchPilot,
  sessionRank,
  pickSessionsForPilot,
  sessionBelongsToPilot,
  mergeLeagueAndCompetitionPilots,
  buildOverrideSet,
  buildSyncPlan,
  summarizePlan,
  filterPlanBySessionIds,
  buildCompetitionTimingPayload,
  isMissingRelationError,
  loadPointOverrides,
  previewLeagueTimingSync,
  applyLeagueTimingSync,
};
