/**
 * Circuitos compartidos de club: validación y helpers CRUD.
 */

function normalizeLaneLengths(numLanes, lane_lengths, existing = []) {
  const lanes = numLanes != null ? parseInt(numLanes, 10) : 1;
  const validLanes = Number.isNaN(lanes) || lanes < 1 ? 1 : lanes;
  let lengths = Array.isArray(lane_lengths) ? lane_lengths : existing;
  if (lengths.length !== validLanes) {
    lengths = Array(validLanes)
      .fill(null)
      .map((_, i) => (lengths[i] != null ? Number(lengths[i]) : 0));
  }
  return {
    num_lanes: validLanes,
    lane_lengths: lengths.slice(0, validLanes).map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0)),
  };
}

async function userIsClubMember(supabase, userId, clubId) {
  const { data: own } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (own?.id) return true;
  const { data: mem } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(mem?.id);
}

async function userIsClubAdmin(supabase, userId, clubId) {
  const { data: own } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (own?.id) return true;
  const { data: mem } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return Boolean(mem);
}

async function getClubCircuit(supabase, clubId, circuitId) {
  const { data, error } = await supabase
    .from('circuits')
    .select('*')
    .eq('id', circuitId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Resuelve circuit_id para cronometraje: personal del usuario o circuito de club (miembro).
 * @returns {Promise<{ ok: true, circuit: object } | { ok: false, error: string, status: number }>}
 */
async function resolveCircuitForTiming(supabase, userId, circuitId) {
  if (!circuitId) {
    return { ok: false, error: 'circuit_id requerido', status: 400 };
  }

  const { data: circuit, error } = await supabase
    .from('circuits')
    .select('id, name, lane_lengths, club_id, user_id')
    .eq('id', circuitId)
    .maybeSingle();

  if (error) throw error;
  if (!circuit) {
    return { ok: false, error: 'Circuito no encontrado', status: 404 };
  }

  if (!circuit.club_id) {
    if (circuit.user_id !== userId) {
      return { ok: false, error: 'Circuito no encontrado o no pertenece al usuario', status: 404 };
    }
    return { ok: true, circuit };
  }

  const member = await userIsClubMember(supabase, userId, circuit.club_id);
  if (!member) {
    return { ok: false, error: 'No perteneces al club de este circuito', status: 403 };
  }

  return { ok: true, circuit };
}

/**
 * Valida circuit_id para competición de club.
 */
async function resolveCircuitForClubCompetition(supabase, userId, clubId, circuitId) {
  if (!circuitId) return { ok: true, circuit: null, circuitName: null };

  const { data: circuit, error } = await supabase
    .from('circuits')
    .select('id, name, club_id, user_id')
    .eq('id', circuitId)
    .maybeSingle();

  if (error) throw error;
  if (!circuit) {
    return { ok: false, error: 'Circuito no encontrado', status: 404 };
  }

  if (circuit.club_id) {
    if (circuit.club_id !== clubId) {
      return { ok: false, error: 'El circuito no pertenece a este club', status: 400 };
    }
    const member = await userIsClubMember(supabase, userId, clubId);
    if (!member) {
      return { ok: false, error: 'No perteneces a este club', status: 403 };
    }
    return { ok: true, circuit, circuitName: circuit.name };
  }

  if (circuit.user_id !== userId) {
    return { ok: false, error: 'Circuito no encontrado', status: 404 };
  }
  return { ok: true, circuit, circuitName: circuit.name };
}

/**
 * Circuitos personales del usuario que pueden vincularse a un circuito del club.
 */
async function listLinkablePersonalCircuits(supabase, userId, clubId, clubCircuitId) {
  const clubCircuit = await getClubCircuit(supabase, clubId, clubCircuitId);
  if (!clubCircuit) {
    return { ok: false, error: 'Circuito del club no encontrado', status: 404 };
  }

  const member = await userIsClubMember(supabase, userId, clubId);
  if (!member) {
    return { ok: false, error: 'No perteneces a este club', status: 403 };
  }

  const { data: personalCircuits, error: circErr } = await supabase
    .from('circuits')
    .select('id, name, description, num_lanes, created_at')
    .eq('user_id', userId)
    .is('club_id', null)
    .neq('id', clubCircuitId)
    .order('name', { ascending: true });

  if (circErr) throw circErr;

  const personalList = personalCircuits || [];
  if (personalList.length === 0) {
    return {
      ok: true,
      club_circuit: { id: clubCircuit.id, name: clubCircuit.name },
      personal_circuits: [],
    };
  }

  const { data: vehicles, error: vehErr } = await supabase
    .from('vehicles')
    .select('id')
    .eq('user_id', userId);

  if (vehErr) throw vehErr;

  const vehicleIds = (vehicles || []).map((v) => v.id);
  if (vehicleIds.length === 0) {
    const clubNameNorm = clubCircuit.name.trim().toLowerCase();
    return {
      ok: true,
      club_circuit: { id: clubCircuit.id, name: clubCircuit.name },
      personal_circuits: personalList.map((c) => ({
        ...c,
        timing_count: 0,
        name_match: c.name.trim().toLowerCase() === clubNameNorm,
      })),
    };
  }

  const { data: timings, error: timErr } = await supabase
    .from('vehicle_timings')
    .select('id, circuit_id')
    .in('vehicle_id', vehicleIds)
    .in(
      'circuit_id',
      personalList.map((c) => c.id),
    );

  if (timErr) throw timErr;

  const countByCircuit = {};
  for (const t of timings || []) {
    if (t.circuit_id) {
      countByCircuit[t.circuit_id] = (countByCircuit[t.circuit_id] || 0) + 1;
    }
  }

  const clubNameNorm = clubCircuit.name.trim().toLowerCase();

  return {
    ok: true,
    club_circuit: { id: clubCircuit.id, name: clubCircuit.name },
    personal_circuits: personalList.map((c) => ({
      ...c,
      timing_count: countByCircuit[c.id] || 0,
      name_match: c.name.trim().toLowerCase() === clubNameNorm,
    })),
  };
}

/**
 * Reasigna tiempos del circuito personal al circuito del club (solo vehículos del usuario).
 */
async function linkPersonalCircuitToClub(
  supabase,
  { userId, clubId, clubCircuitId, personalCircuitId, deletePersonal = false },
) {
  if (personalCircuitId === clubCircuitId) {
    return { ok: false, error: 'El circuito personal y el del club son el mismo', status: 400 };
  }

  const clubCircuit = await getClubCircuit(supabase, clubId, clubCircuitId);
  if (!clubCircuit) {
    return { ok: false, error: 'Circuito del club no encontrado', status: 404 };
  }

  const member = await userIsClubMember(supabase, userId, clubId);
  if (!member) {
    return { ok: false, error: 'No perteneces a este club', status: 403 };
  }

  const { data: personalCircuit, error: personalErr } = await supabase
    .from('circuits')
    .select('id, name, user_id, club_id')
    .eq('id', personalCircuitId)
    .maybeSingle();

  if (personalErr) throw personalErr;
  if (!personalCircuit || personalCircuit.user_id !== userId || personalCircuit.club_id) {
    return { ok: false, error: 'Circuito personal no encontrado', status: 404 };
  }

  const { data: vehicles, error: vehErr } = await supabase
    .from('vehicles')
    .select('id')
    .eq('user_id', userId);

  if (vehErr) throw vehErr;

  const vehicleIds = (vehicles || []).map((v) => v.id);
  if (vehicleIds.length === 0) {
    return {
      ok: true,
      migrated_timings: 0,
      deleted_personal: false,
      club_circuit: { id: clubCircuit.id, name: clubCircuit.name },
      personal_circuit: { id: personalCircuit.id, name: personalCircuit.name },
    };
  }

  const { data: toMigrate, error: countErr } = await supabase
    .from('vehicle_timings')
    .select('id')
    .in('vehicle_id', vehicleIds)
    .eq('circuit_id', personalCircuitId);

  if (countErr) throw countErr;

  const timingIds = (toMigrate || []).map((t) => t.id);

  if (timingIds.length > 0) {
    const { error: updateErr } = await supabase
      .from('vehicle_timings')
      .update({
        circuit_id: clubCircuitId,
        circuit: clubCircuit.name,
      })
      .in('id', timingIds);

    if (updateErr) throw updateErr;
  }

  let deletedPersonal = false;

  if (deletePersonal) {
    const [
      { count: vtLeft },
      { count: compLeft },
      { count: ctLeft },
    ] = await Promise.all([
      supabase
        .from('vehicle_timings')
        .select('*', { count: 'exact', head: true })
        .eq('circuit_id', personalCircuitId),
      supabase
        .from('competitions')
        .select('*', { count: 'exact', head: true })
        .eq('circuit_id', personalCircuitId),
      supabase
        .from('competition_timings')
        .select('*', { count: 'exact', head: true })
        .eq('circuit_id', personalCircuitId),
    ]);

    if ((vtLeft || 0) > 0 || (compLeft || 0) > 0 || (ctLeft || 0) > 0) {
      return {
        ok: false,
        error: 'No se puede eliminar el circuito personal: sigue referenciado en otros datos',
        status: 400,
        migrated_timings: timingIds.length,
      };
    }

    const { error: delErr } = await supabase
      .from('circuits')
      .delete()
      .eq('id', personalCircuitId)
      .eq('user_id', userId)
      .is('club_id', null);

    if (delErr) throw delErr;
    deletedPersonal = true;
  }

  return {
    ok: true,
    migrated_timings: timingIds.length,
    deleted_personal: deletedPersonal,
    club_circuit: { id: clubCircuit.id, name: clubCircuit.name },
    personal_circuit: { id: personalCircuit.id, name: personalCircuit.name },
  };
}

module.exports = {
  normalizeLaneLengths,
  userIsClubMember,
  userIsClubAdmin,
  getClubCircuit,
  resolveCircuitForTiming,
  resolveCircuitForClubCompetition,
  listLinkablePersonalCircuits,
  linkPersonalCircuitToClub,
};
