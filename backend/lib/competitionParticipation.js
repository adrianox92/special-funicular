'use strict';

/**
 * Un usuario está inscrito en una competición cuando es participante oficial
 * con un vehículo de su garaje. Los tiempos de la prueba cuelgan de esa fila
 * (`competition_timings.participant_id`), así que ver la competición no depende
 * de ser organizador ni de que la prueba tenga club.
 */

function collectEnrolledCompetitionIds(participants) {
  const ids = [];
  const seen = new Set();
  for (const row of participants || []) {
    const competitionId = row?.competition_id;
    if (!competitionId || seen.has(competitionId)) continue;
    seen.add(competitionId);
    ids.push(competitionId);
  }
  return ids;
}

function formatMyCompetition(comp, viewerRole) {
  const { competition_participants, ...rest } = comp;
  const counted = comp.participants_count ?? competition_participants?.[0]?.count ?? 0;
  return {
    ...rest,
    participants_count: counted,
    viewer_role: viewerRole,
  };
}

/**
 * Organizer y club se conservan. La inscripción solo añade las que faltan.
 * @param {{ owned?: object[], club?: object[], enrolled?: object[] }} lists
 */
function mergeMyCompetitions({ owned = [], club = [], enrolled = [] } = {}) {
  const byId = new Map();
  for (const comp of owned) {
    if (!comp?.id) continue;
    byId.set(comp.id, formatMyCompetition(comp, 'organizer'));
  }
  for (const comp of club) {
    if (!comp?.id || byId.has(comp.id)) continue;
    byId.set(comp.id, formatMyCompetition(comp, 'club'));
  }
  for (const comp of enrolled) {
    if (!comp?.id || byId.has(comp.id)) continue;
    byId.set(comp.id, formatMyCompetition(comp, 'participant'));
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Ids de competición en las que `userId` es participante oficial
 * (vehicle_id de un coche suyo).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function listEnrolledCompetitionIds(supabase, userId) {
  if (!userId) return [];

  const { data: vehicles, error: vehicleErr } = await supabase
    .from('vehicles')
    .select('id')
    .eq('user_id', userId);

  if (vehicleErr) {
    throw new Error(vehicleErr.message);
  }

  const vehicleIds = (vehicles || []).map((row) => row.id).filter(Boolean);
  if (vehicleIds.length === 0) return [];

  const { data: participants, error: partErr } = await supabase
    .from('competition_participants')
    .select('id, competition_id, vehicle_id')
    .in('vehicle_id', vehicleIds);

  if (partErr) {
    throw new Error(partErr.message);
  }

  return collectEnrolledCompetitionIds(participants);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} competitionId
 */
async function userIsEnrolledParticipant(supabase, userId, competitionId) {
  if (!userId || !competitionId) return false;
  const ids = await listEnrolledCompetitionIds(supabase, userId);
  return ids.includes(competitionId);
}

/**
 * Rol de quien ya puede ver la prueba. Organizador gana sobre inscrito y club.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string } | null | undefined} user
 * @param {{ id?: string, organizer?: string|null }} competition
 * @param {(user: object) => boolean} isOrganizerLike
 */
async function resolveCompetitionViewerRole(supabase, user, competition, isOrganizerLike) {
  if (!user?.id || !competition) return null;
  if (typeof isOrganizerLike === 'function' && isOrganizerLike(user)) return 'organizer';
  if (competition.organizer === user.id) return 'organizer';
  if (competition.id && (await userIsEnrolledParticipant(supabase, user.id, competition.id))) {
    return 'participant';
  }
  return 'club';
}

module.exports = {
  collectEnrolledCompetitionIds,
  formatMyCompetition,
  mergeMyCompetitions,
  listEnrolledCompetitionIds,
  userIsEnrolledParticipant,
  resolveCompetitionViewerRole,
};
