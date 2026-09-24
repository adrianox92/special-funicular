'use strict';

/**
 * Roster de socios con cuenta (no invitados).
 * Misma forma base que GET /api/clubs/:id/members (JWT), más display_name (D10).
 */

function displayNameFromAuthUser(user) {
  const meta = user?.user_metadata || {};
  const fromMeta = meta.full_name || meta.name || meta.display_name;
  if (fromMeta != null && String(fromMeta).trim()) return String(fromMeta).trim();
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clubId
 * @returns {Promise<
 *   | { ok: true, payload: { members: object[], owner_user_id: string } }
 *   | { ok: false, status: number, error: string }
 * >}
 */
async function listClubAccountMembers(supabase, clubId) {
  const { data: clubRow, error: clubErr } = await supabase
    .from('clubs')
    .select('owner_user_id')
    .eq('id', clubId)
    .maybeSingle();
  if (clubErr) return { ok: false, status: 500, error: clubErr.message };
  if (!clubRow) return { ok: false, status: 404, error: 'Club no encontrado' };

  const { data: rows, error } = await supabase
    .from('club_members')
    .select('id, user_id, role, joined_at')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true });
  if (error) return { ok: false, status: 500, error: error.message };

  const userIds = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
  const profileByUser = new Map();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('pilot_public_profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);
    for (const p of profiles || []) {
      profileByUser.set(p.user_id, p);
    }
  }

  const members = [];
  for (const row of rows || []) {
    let email = null;
    let metaName = null;
    try {
      const { data: u, error: uErr } = await supabase.auth.admin.getUserById(row.user_id);
      if (uErr) {
        console.error('listClubAccountMembers getUserById', row.user_id, uErr);
      } else {
        email = u?.user?.email ?? null;
        metaName = displayNameFromAuthUser(u?.user);
      }
    } catch (authErr) {
      console.error('listClubAccountMembers getUserById', row.user_id, authErr);
    }

    const profileName = profileByUser.get(row.user_id)?.display_name;
    const display_name =
      (profileName != null && String(profileName).trim()) || metaName || null;

    members.push({
      id: row.id,
      user_id: row.user_id,
      display_name,
      email,
      role: row.role,
      joined_at: row.joined_at,
      is_owner: row.user_id === clubRow.owner_user_id,
    });
  }

  return { ok: true, payload: { members, owner_user_id: clubRow.owner_user_id } };
}

module.exports = {
  listClubAccountMembers,
  displayNameFromAuthUser,
};
