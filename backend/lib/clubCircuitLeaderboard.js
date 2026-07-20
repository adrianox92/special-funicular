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
 * Mejor vuelta por piloto en un circuito de club.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ clubId: string, circuitId: string, lane?: string|null, period?: string, vehicleType?: string|null }} params
 */
async function buildClubCircuitLeaderboard(supabase, { clubId, circuitId, lane, period, vehicleType }) {
  const { since, label: periodLabel } = parsePeriodFilter(period);

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

  if (lane != null && String(lane).trim() !== '') {
    query = query.eq('lane', String(lane).trim());
  }
  const vehicleTypeFilter =
    vehicleType != null && String(vehicleType).trim() !== '' ? String(vehicleType).trim() : null;
  if (vehicleTypeFilter) {
    query = query.eq('vehicles.type', vehicleTypeFilter);
  }
  if (since) {
    query = query.gte('timing_date', since);
  }

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

  for (const row of rows || []) {
    const vehicle = row.vehicles;
    const userId = vehicle?.user_id;
    if (!userId || !memberUserIds.has(userId)) continue;

    const lapSec = bestLapSecondsFromTimingRow(row);
    if (lapSec == null) continue;

    const prev = bestByUser.get(userId);
    if (!prev || lapSec < prev.lapSeconds) {
      bestByUser.set(userId, {
        user_id: userId,
        lapSeconds: lapSec,
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
    } else if (lapSec === prev.lapSeconds) {
      const prevDate = prev.timing_date || '';
      const rowDate = row.timing_date || '';
      if (rowDate > prevDate) {
        bestByUser.set(userId, {
          ...prev,
          timing_date: row.timing_date,
          timing_id: row.id,
        });
      }
    }
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

  if (lane != null && String(lane).trim() !== '') {
    guestQuery = guestQuery.eq('lane', String(lane).trim());
  }
  if (vehicleTypeFilter) {
    guestQuery = guestQuery.eq('vehicle_type', vehicleTypeFilter);
  }
  if (since) {
    guestQuery = guestQuery.gte('timing_date', since);
  }

  const { data: guestRows, error: guestErr } = await guestQuery;
  if (guestErr) throw guestErr;

  const bestByGuest = new Map();

  for (const row of guestRows || []) {
    const guest = row.club_guest_members;
    const guestMemberId = row.guest_member_id;
    const linkedUserId = guest?.linked_user_id;

    const lapSec = bestLapSecondsFromTimingRow(row);
    if (lapSec == null) continue;

    const entryBase = {
      lapSeconds: lapSec,
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
    };

    if (linkedUserId) {
      const prev = bestByUser.get(linkedUserId);
      if (!prev || lapSec < prev.lapSeconds) {
        bestByUser.set(linkedUserId, {
          user_id: linkedUserId,
          ...entryBase,
        });
      } else if (lapSec === prev.lapSeconds) {
        const prevDate = prev.timing_date || '';
        const rowDate = row.timing_date || '';
        if (rowDate > prevDate) {
          bestByUser.set(linkedUserId, { ...prev, timing_date: row.timing_date, timing_id: row.id });
        }
      }
      continue;
    }

    const prevGuest = bestByGuest.get(guestMemberId);
    if (!prevGuest || lapSec < prevGuest.lapSeconds) {
      bestByGuest.set(guestMemberId, {
        guest_member_id: guestMemberId,
        display_name: guest?.name || null,
        ...entryBase,
      });
    } else if (lapSec === prevGuest.lapSeconds) {
      const prevDate = prevGuest.timing_date || '';
      const rowDate = row.timing_date || '';
      if (rowDate > prevDate) {
        bestByGuest.set(guestMemberId, {
          ...prevGuest,
          timing_date: row.timing_date,
          timing_id: row.id,
        });
      }
    }
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
    lane: lane != null && String(lane).trim() !== '' ? String(lane).trim() : null,
    vehicle_type: vehicleTypeFilter,
    entries: ranked,
  };
}

module.exports = {
  parsePeriodFilter,
  buildClubCircuitLeaderboard,
  timeToSeconds,
};
