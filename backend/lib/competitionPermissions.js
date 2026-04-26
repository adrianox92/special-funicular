/**
 * Permisos de competición: organizador vs miembros del club (lectura).
 * La gestión (reglas, participantes, etc.) sigue siendo solo `organizer`,
 * salvo administradores de licencia (`LICENSE_ADMIN_EMAILS`) para depuración.
 */

const { isLicenseAdminUser } = require('./licenseAdminAuth');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 * @param {string} [select]
 */
async function fetchCompetitionAccess(supabase, competitionId, select = 'id, organizer, club_id') {
  const { data, error } = await supabase
    .from('competitions')
    .select(select)
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

module.exports = {
  fetchCompetitionAccess,
  canViewCompetition,
  canManageCompetition,
  requireViewCompetition,
  requireManageCompetition,
};
