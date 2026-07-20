const { bestLapSecondsFromInput } = require('./personalBest');

async function assertGuestMemberInClub(supabase, clubId, guestId) {
  const { data, error } = await supabase
    .from('club_guest_members')
    .select('id, club_id, name, email, linked_user_id, created_at')
    .eq('id', guestId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertClubCircuit(supabase, clubId, circuitId) {
  const { data, error } = await supabase
    .from('circuits')
    .select('id, name, club_id')
    .eq('id', circuitId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: 'Circuito no encontrado' };
  if (data.club_id !== clubId) return { ok: false, error: 'El circuito no pertenece a este club' };
  return { ok: true, circuit: data };
}

function normalizeGuestTimingBody(body, { source = 'manual', enteredBy = null } = {}) {
  const bestLapTime = body.best_lap_time != null ? String(body.best_lap_time).trim() : '';
  if (!bestLapTime) return { error: 'best_lap_time es obligatorio' };

  const lapSec = bestLapSecondsFromInput({
    best_lap_time: bestLapTime,
    best_lap_timestamp: body.best_lap_timestamp,
  });
  if (lapSec == null) return { error: 'best_lap_time no es válido' };

  const circuitId = body.circuit_id;
  if (!circuitId) return { error: 'circuit_id es obligatorio' };

  const timingDate =
    body.timing_date != null && String(body.timing_date).trim() !== ''
      ? String(body.timing_date).trim()
      : new Date().toISOString().slice(0, 10);

  const row = {
    circuit_id: circuitId,
    best_lap_time: bestLapTime,
    best_lap_timestamp:
      body.best_lap_timestamp != null && Number(body.best_lap_timestamp) > 0
        ? Number(body.best_lap_timestamp)
        : lapSec,
    timing_date: timingDate,
    lane: body.lane != null && String(body.lane).trim() !== '' ? String(body.lane).trim() : null,
    laps: body.laps != null && body.laps !== '' ? parseInt(String(body.laps), 10) : null,
    consistency_score:
      body.consistency_score != null && body.consistency_score !== ''
        ? Number(body.consistency_score)
        : null,
    vehicle_model:
      body.vehicle_model != null && String(body.vehicle_model).trim() !== ''
        ? String(body.vehicle_model).trim()
        : null,
    vehicle_type:
      body.vehicle_type != null && String(body.vehicle_type).trim() !== ''
        ? String(body.vehicle_type).trim()
        : null,
    notes: body.notes != null && String(body.notes).trim() !== '' ? String(body.notes).trim() : null,
    source: source === 'app' ? 'app' : 'manual',
    entered_by: enteredBy,
  };

  if (row.laps != null && Number.isNaN(row.laps)) return { error: 'laps no es válido' };
  if (row.consistency_score != null && Number.isNaN(row.consistency_score)) {
    return { error: 'consistency_score no es válido' };
  }

  return { row, lapSec };
}

async function enrichGuestMembersWithLinkedEmails(supabase, guests) {
  const linkedIds = [...new Set((guests || []).map((g) => g.linked_user_id).filter(Boolean))];
  const emailByUser = new Map();
  for (const uid of linkedIds) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      emailByUser.set(uid, u?.user?.email ?? null);
    } catch {
      emailByUser.set(uid, null);
    }
  }
  return (guests || []).map((g) => ({
    ...g,
    linked_user_email: g.linked_user_id ? emailByUser.get(g.linked_user_id) ?? null : null,
  }));
}

module.exports = {
  assertGuestMemberInClub,
  assertClubCircuit,
  normalizeGuestTimingBody,
  enrichGuestMembersWithLinkedEmails,
};
