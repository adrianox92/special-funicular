const { timeToSeconds } = require('./positionTracker');
const { bestLapSecondsFromTimingRow } = require('./personalBest');

function parsePeriodFilter(period) {
  const p = period ? String(period).trim().toLowerCase() : '';
  if (!p || p === 'all') return { since: null, label: 'all' };
  const now = new Date();
  if (p === 'month') {
    const since = new Date(now.getFullYear(), now.getMonth(), 1);
    return { since: since.toISOString().slice(0, 10), label: 'month' };
  }
  if (p === 'season') {
    const since = new Date(now);
    since.setDate(since.getDate() - 90);
    return { since: since.toISOString().slice(0, 10), label: 'season' };
  }
  return { since: null, label: 'all' };
}

/**
 * Actualiza el mejor tiempo de un mapa (por user_id o guest_member_id).
 * @param {Map<string, object>} map
 * @param {string} key
 * @param {number} lapSec
 * @param {object} entry
 */
function upsertBestLap(map, key, lapSec, entry) {
  const prev = map.get(key);
  if (!prev || lapSec < prev.lapSeconds) {
    map.set(key, { ...entry, lapSeconds: lapSec });
    return;
  }
  if (lapSec === prev.lapSeconds) {
    const prevDate = prev.timing_date || '';
    const rowDate = entry.timing_date || '';
    if (rowDate > prevDate) {
      map.set(key, {
        ...prev,
        timing_date: entry.timing_date,
        timing_id: entry.timing_id,
      });
    }
  }
}

/**
 * Aplica un tiempo de invitado: fusiona con usuario vinculado o ranking de guest.
 */
function applyGuestLap(bestByUser, bestByGuest, { guestMemberId, linkedUserId, guestName, lapSec, entryBase }) {
  if (linkedUserId) {
    upsertBestLap(bestByUser, linkedUserId, lapSec, {
      user_id: linkedUserId,
      ...entryBase,
    });
    return;
  }
  upsertBestLap(bestByGuest, guestMemberId, lapSec, {
    guest_member_id: guestMemberId,
    display_name: guestName || null,
    ...entryBase,
  });
}

/**
 * Mejor vuelta por piloto en un circuito de club.
 * Incluye vehicle_timings, club_guest_timings y competition_timings del mismo circuito.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ clubId: string, circuitId: string, lane?: string|null, period?: string, vehicleType?: string|null }} params
 */
async function buildClubCircuitLeaderboard(supabase, { clubId, circuitId, lane, period, vehicleType }) {
  const { since, label: periodLabel } = parsePeriodFilter(period);
  const laneFilter = lane != null && String(lane).trim() !== '' ? String(lane).trim() : null;
  const vehicleTypeFilter =
    vehicleType != null && String(vehicleType).trim() !== '' ? String(vehicleType).trim() : null;

  let query = supabase
    .from('vehicle_timings')
    .select(
      `
      id,
      vehicle_id,
      best_lap_time,
      best_lap_timestamp,
      timing_date,
      lane,
      laps,
      consistency_score,
      vehicles!inner (
        id,
        user_id,
        model,
        type
      )
    `,
    )
    .eq('circuit_id', circuitId)
    .not('best_lap_time', 'is', null);

  if (laneFilter) query = query.eq('lane', laneFilter);
  if (vehicleTypeFilter) query = query.eq('vehicles.type', vehicleTypeFilter);
  if (since) query = query.gte('timing_date', since);

  const { data: rows, error } = await query;
  if (error) throw error;

  const memberUserIds = new Set();
  const { data: members } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId);
  for (const m of members || []) memberUserIds.add(m.user_id);

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('owner_user_id')
    .eq('id', clubId)
    .maybeSingle();
  if (clubRow?.owner_user_id) memberUserIds.add(clubRow.owner_user_id);

  const bestByUser = new Map();
  const bestByGuest = new Map();

  for (const row of rows || []) {
    const vehicle = row.vehicles;
    const userId = vehicle?.user_id;
    if (!userId || !memberUserIds.has(userId)) continue;

    const lapSec = bestLapSecondsFromTimingRow(row);
    if (lapSec == null) continue;

    upsertBestLap(bestByUser, userId, lapSec, {
      user_id: userId,
      best_lap_time: row.best_lap_time,
      best_lap_timestamp: row.best_lap_timestamp,
      timing_date: row.timing_date,
      lane: row.lane,
      laps: row.laps,
      consistency_score: row.consistency_score,
      vehicle_model: vehicle?.model || null,
      vehicle_type: vehicle?.type || null,
      timing_id: row.id,
    });
  }

  let guestQuery = supabase
    .from('club_guest_timings')
    .select(
      `
      id,
      guest_member_id,
      best_lap_time,
      best_lap_timestamp,
      timing_date,
      lane,
      laps,
      consistency_score,
      vehicle_model,
      vehicle_type,
      club_guest_members!inner (
        id,
        name,
        linked_user_id
      )
    `,
    )
    .eq('club_id', clubId)
    .eq('circuit_id', circuitId)
    .not('best_lap_time', 'is', null);

  if (laneFilter) guestQuery = guestQuery.eq('lane', laneFilter);
  if (vehicleTypeFilter) guestQuery = guestQuery.eq('vehicle_type', vehicleTypeFilter);
  if (since) guestQuery = guestQuery.gte('timing_date', since);

  const { data: guestRows, error: guestErr } = await guestQuery;
  if (guestErr) throw guestErr;

  for (const row of guestRows || []) {
    const guest = row.club_guest_members;
    const guestMemberId = row.guest_member_id;
    const lapSec = bestLapSecondsFromTimingRow(row);
    if (lapSec == null) continue;

    applyGuestLap(bestByUser, bestByGuest, {
      guestMemberId,
      linkedUserId: guest?.linked_user_id,
      guestName: guest?.name,
      lapSec,
      entryBase: {
        best_lap_time: row.best_lap_time,
        best_lap_timestamp: row.best_lap_timestamp,
        timing_date: row.timing_date,
        lane: row.lane,
        laps: row.laps,
        consistency_score: row.consistency_score,
        vehicle_model: row.vehicle_model,
        vehicle_type: row.vehicle_type,
        timing_id: row.id,
        guest_name: guest?.name || null,
      },
    });
  }

  // Tiempos de competición en el mismo circuito (miembros e invitados del club).
  let compQuery = supabase
    .from('competition_timings')
    .select(
      `
      id,
      best_lap_time,
      best_lap_timestamp,
      timing_date,
      lane,
      laps,
      did_not_participate,
      participant_id,
      competition_participants!inner (
        id,
        vehicle_id,
        vehicle_model,
        driver_name,
        from_guest_member_id,
        vehicles (
          id,
          user_id,
          model,
          type
        )
      )
    `,
    )
    .eq('circuit_id', circuitId)
    .not('best_lap_time', 'is', null);

  if (laneFilter) compQuery = compQuery.eq('lane', laneFilter);
  if (since) compQuery = compQuery.gte('timing_date', since);

  const { data: compRows, error: compErr } = await compQuery;
  if (compErr) throw compErr;

  const guestIdsFromComp = new Set();
  for (const row of compRows || []) {
    const gid = row.competition_participants?.from_guest_member_id;
    if (gid) guestIdsFromComp.add(gid);
  }

  const guestById = new Map();
  if (guestIdsFromComp.size > 0) {
    const { data: guestMembers, error: gmErr } = await supabase
      .from('club_guest_members')
      .select('id, name, linked_user_id, club_id')
      .eq('club_id', clubId)
      .in('id', [...guestIdsFromComp]);
    if (gmErr) throw gmErr;
    for (const g of guestMembers || []) {
      guestById.set(g.id, g);
    }
  }

  for (const row of compRows || []) {
    if (row.did_not_participate) continue;

    const participant = row.competition_participants;
    if (!participant) continue;

    const lapSec = bestLapSecondsFromTimingRow(row);
    if (lapSec == null) continue;

    const vehicle = participant.vehicles;
    const vehicleModel = vehicle?.model || participant.vehicle_model || null;
    const vehicleType = vehicle?.type || null;

    if (vehicleTypeFilter) {
      if (!vehicleType || vehicleType !== vehicleTypeFilter) continue;
    }

    const entryBase = {
      best_lap_time: row.best_lap_time,
      best_lap_timestamp: row.best_lap_timestamp,
      timing_date: row.timing_date,
      lane: row.lane,
      laps: row.laps,
      consistency_score: null,
      vehicle_model: vehicleModel,
      vehicle_type: vehicleType,
      timing_id: row.id,
    };

    const guestMemberId = participant.from_guest_member_id;
    if (guestMemberId) {
      const guest = guestById.get(guestMemberId);
      if (!guest) continue; // no es invitado de este club
      applyGuestLap(bestByUser, bestByGuest, {
        guestMemberId,
        linkedUserId: guest.linked_user_id,
        guestName: guest.name || participant.driver_name,
        lapSec,
        entryBase: {
          ...entryBase,
          guest_name: guest.name || participant.driver_name || null,
        },
      });
      continue;
    }

    const userId = vehicle?.user_id;
    if (!userId || !memberUserIds.has(userId)) continue;

    upsertBestLap(bestByUser, userId, lapSec, {
      user_id: userId,
      ...entryBase,
    });
  }

  const userIds = [...bestByUser.keys()];
  const profileByUser = new Map();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('pilot_public_profiles')
      .select('user_id, display_name, slug, enabled')
      .in('user_id', userIds);
    for (const p of profiles || []) {
      profileByUser.set(p.user_id, p);
    }
  }

  const combined = [
    ...[...bestByUser.values()].map((entry) => {
      const profile = profileByUser.get(entry.user_id);
      return {
        user_id: entry.user_id,
        guest_member_id: null,
        is_guest: false,
        display_name: profile?.display_name || null,
        pilot_slug: profile?.enabled ? profile.slug : null,
        best_lap_time: entry.best_lap_time,
        best_lap_seconds: entry.lapSeconds,
        timing_date: entry.timing_date,
        lane: entry.lane,
        laps: entry.laps,
        consistency_score: entry.consistency_score,
        vehicle_model: entry.vehicle_model,
        vehicle_type: entry.vehicle_type,
      };
    }),
    ...[...bestByGuest.values()].map((entry) => ({
      user_id: null,
      guest_member_id: entry.guest_member_id,
      is_guest: true,
      display_name: entry.display_name,
      pilot_slug: null,
      best_lap_time: entry.best_lap_time,
      best_lap_seconds: entry.lapSeconds,
      timing_date: entry.timing_date,
      lane: entry.lane,
      laps: entry.laps,
      consistency_score: entry.consistency_score,
      vehicle_model: entry.vehicle_model,
      vehicle_type: entry.vehicle_type,
    })),
  ];

  const ranked = combined
    .sort((a, b) => {
      if (a.best_lap_seconds !== b.best_lap_seconds) return a.best_lap_seconds - b.best_lap_seconds;
      const ca = a.consistency_score ?? Infinity;
      const cb = b.consistency_score ?? Infinity;
      if (ca !== cb) return ca - cb;
      return String(b.timing_date || '').localeCompare(String(a.timing_date || ''));
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  return {
    period: periodLabel,
    lane: laneFilter,
    vehicle_type: vehicleTypeFilter,
    entries: ranked,
  };
}

module.exports = {
  parsePeriodFilter,
  buildClubCircuitLeaderboard,
  upsertBestLap,
  applyGuestLap,
  timeToSeconds,
};
