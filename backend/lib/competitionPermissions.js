/**
 * Permisos de competición: organizador vs miembros del club (lectura).
 * La gestión (reglas, participantes, etc.) sigue siendo solo `organizer`,
 * salvo administradores de licencia (`LICENSE_ADMIN_EMAILS`) para depuración.
 */

const { isLicenseAdminUser } = require('./licenseAdminAuth');

function ensureSelectIncludesStatus(select) {
  const s = select && String(select).trim() ? String(select).trim() : 'id, organizer, club_id';
  if (/\bstatus\b/.test(s)) return s;
  return `${s},status`;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 * @param {string} [select]
 */
async function fetchCompetitionAccess(supabase, competitionId, select = 'id, organizer, club_id') {
  const selectResolved = ensureSelectIncludesStatus(select);
  const { data, error } = await supabase
    .from('competitions')
    .select(selectResolved)
    .eq('id', competitionId)
    .maybeSingle();
  return { competition: data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {{ organizer?: string|null, club_id?: string|null }} competition
 */
async function canViewCompetition(supabase, user, competition) {
  if (!competition || !user?.id) return false;
  if (isLicenseAdminUser(user)) return true;
  const userId = user.id;
  if (competition.organizer === userId) return true;
  if (!competition.club_id) return false;
  const { data: mem } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', competition.club_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (mem) return true;
  const { data: ownClub } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', competition.club_id)
    .eq('owner_user_id', userId)
    .maybeSingle();
  return Boolean(ownClub);
}

/**
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {{ organizer?: string|null }} competition
 */
function canManageCompetition(user, competition) {
  if (!competition || !user?.id) return false;
  if (isLicenseAdminUser(user)) return true;
  return competition.organizer === user.id;
}

/**
 * Token de enlace árbitro válido para esta competición.
 * @param {{ referee_access_token?: string|null }} competition
 * @param {string|undefined|null} refereeToken
 */
function isValidRefereeAccessToken(competition, refereeToken) {
  const stored = competition?.referee_access_token;
  const provided = refereeToken && String(refereeToken).trim();
  if (!stored || !provided) return false;
  return stored === provided;
}

/**
 * Modo árbitro: gestionar tiempos (organizador, admin de licencia o enlace con token).
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {{ organizer?: string|null, referee_access_token?: string|null }} competition
 * @param {string} [refereeToken]
 */
function canRefereeCompetition(user, competition, refereeToken) {
  if (!competition) return false;
  if (canManageCompetition(user, competition)) return true;
  return isValidRefereeAccessToken(competition, refereeToken);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} token
 * @param {string} [select]
 */
async function fetchCompetitionByRefereeToken(supabase, token, select = 'id, name, rounds, circuit_id, status, organizer, referee_access_token') {
  const trimmed = token && String(token).trim();
  if (!trimmed) return { competition: null, error: null };
  const { data, error } = await supabase
    .from('competitions')
    .select(select)
    .eq('referee_access_token', trimmed)
    .maybeSingle();
  return { competition: data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {string} competitionId
 * @param {string} [select]
 * @returns {Promise<{ ok: true, competition: object } | { ok: false, respond: (res: import('express').Response) => void }>}
 */
async function requireViewCompetition(supabase, user, competitionId, select = 'id, organizer, club_id') {
  const { competition, error } = await fetchCompetitionAccess(supabase, competitionId, select);
  if (error || !competition) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Competición no encontrada' }),
    };
  }
  const view = await canViewCompetition(supabase, user, competition);
  if (!view) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Competición no encontrada' }),
    };
  }
  return { ok: true, competition };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {string} competitionId
 * @param {string} [select]
 * @returns {Promise<{ ok: true, competition: object } | { ok: false, respond: (res: import('express').Response) => void }>}
 */
async function requireManageCompetition(supabase, user, competitionId, select = 'id, organizer, club_id') {
  const r = await requireViewCompetition(supabase, user, competitionId, select);
  if (!r.ok) return r;
  if (!canManageCompetition(user, r.competition)) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Competición no encontrada' }),
    };
  }
  return { ok: true, competition: r.competition };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, email?: string } | null | undefined} user
 * @param {string} competitionId
 * @param {string} [select]
 * @param {string} [refereeToken]
 */
async function requireRefereeCompetition(
  supabase,
  user,
  competitionId,
  select = 'id, organizer, club_id, rounds, status, referee_access_token',
  refereeToken,
) {
  const { competition, error } = await fetchCompetitionAccess(supabase, competitionId, select);
  if (error || !competition) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Competición no encontrada' }),
    };
  }
  if (!canRefereeCompetition(user, competition, refereeToken)) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Competición no encontrada' }),
    };
  }
  return { ok: true, competition };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} token
 * @param {string} [select]
 */
async function requireRefereeByToken(supabase, token, select = 'id, name, rounds, circuit_id, status, organizer, referee_access_token') {
  const { competition, error } = await fetchCompetitionByRefereeToken(supabase, token, select);
  if (error || !competition) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Enlace no válido o desactivado' }),
    };
  }
  return { ok: true, competition };
}

module.exports = {
  fetchCompetitionAccess,
  fetchCompetitionByRefereeToken,
  canViewCompetition,
  canManageCompetition,
  canRefereeCompetition,
  isValidRefereeAccessToken,
  requireViewCompetition,
  requireManageCompetition,
  requireRefereeCompetition,
  requireRefereeByToken,
};
