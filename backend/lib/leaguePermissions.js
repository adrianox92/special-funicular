const { isLicenseAdminUser } = require('./licenseAdminAuth');

async function userOwnsClub(supabase, userId, clubId) {
  if (!clubId) return false;
  const { data } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function userIsClubAdmin(supabase, userId, clubId) {
  if (!clubId) return false;
  if (await userOwnsClub(supabase, userId, clubId)) return true;
  const { data } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return Boolean(data);
}

async function userIsClubMember(supabase, userId, clubId) {
  if (!clubId) return false;
  if (await userOwnsClub(supabase, userId, clubId)) return true;
  const { data } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.id);
}

function canManageLeague(user, league) {
  if (!user || !league) return false;
  if (isLicenseAdminUser(user)) return true;
  return league.organizer === user.id;
}

async function canViewLeague(supabase, user, league) {
  if (!user || !league) return false;
  if (canManageLeague(user, league)) return true;
  if (league.club_id && (await userIsClubMember(supabase, user.id, league.club_id))) {
    return true;
  }
  return false;
}

async function requireViewLeague(supabase, user, leagueId) {
  const { data: league, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .maybeSingle();

  if (error || !league) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Liga no encontrada' }),
    };
  }

  const allowed = await canViewLeague(supabase, user, league);
  if (!allowed) {
    return {
      ok: false,
      respond: (res) => res.status(404).json({ error: 'Liga no encontrada' }),
    };
  }

  return { ok: true, league };
}

async function requireManageLeague(supabase, user, leagueId) {
  const access = await requireViewLeague(supabase, user, leagueId);
  if (!access.ok) return access;

  if (!canManageLeague(user, access.league)) {
    return {
      ok: false,
      respond: (res) => res.status(403).json({ error: 'No autorizado' }),
    };
  }

  return access;
}

module.exports = {
  canManageLeague,
  canViewLeague,
  requireViewLeague,
  requireManageLeague,
  userIsClubMember,
  userIsClubAdmin,
};
