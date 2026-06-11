'use strict';

const {
  participantMatchKey,
  registerStandingsEntry,
  resolveParticipantKey,
} = require('./leagueStandings');

/**
 * Índice de participantes existentes para emparejar por nombre/email.
 * @param {Array<{ id: string, name: string, email?: string|null, vehicle_id?: string|null, vehicle_model?: string|null, status?: string }>} participants
 */
function buildParticipantIndex(participants) {
  const byKey = new Map();
  const keyAliases = new Map();

  for (const row of participants) {
    const canonicalKey = resolveParticipantKey(keyAliases, byKey, row.name, row.email);
    if (!byKey.has(canonicalKey)) {
      registerStandingsEntry(byKey, keyAliases, canonicalKey, row);
    }
  }

  return { byKey, keyAliases };
}

/**
 * @param {{ byKey: Map, keyAliases: Map }} index
 * @param {string} name
 * @param {string|null} email
 */
function resolveFromIndex(index, name, email) {
  const canonicalKey = resolveParticipantKey(index.keyAliases, index.byKey, name, email);
  return index.byKey.get(canonicalKey) || null;
}

/**
 * Registra un candidato en el mapa de importación, fusionando datos si ya existe.
 * @param {Map<string, object>} candidates
 * @param {Map<string, string>} keyAliases
 */
function registerImportCandidate(candidates, keyAliases, row) {
  const name = String(row.name || '').trim();
  if (!name) return;

  const email = row.email ? String(row.email).trim().toLowerCase() : null;
  const canonicalKey = resolveParticipantKey(keyAliases, candidates, name, email);
  const current = candidates.get(canonicalKey);

  if (!current) {
    const entry = {
      name,
      email,
      vehicle_id: row.vehicle_id || null,
      vehicle_model: row.vehicle_model || null,
    };
    registerStandingsEntry(candidates, keyAliases, canonicalKey, entry);
    return;
  }

  if (!current.email && email) current.email = email;
  if (!current.vehicle_id && row.vehicle_id) current.vehicle_id = row.vehicle_id;
  if (!current.vehicle_model && row.vehicle_model) current.vehicle_model = row.vehicle_model;
  if (email) {
    keyAliases.set(participantMatchKey(name, email), canonicalKey);
  }
}

/**
 * Importa participantes de competiciones vinculadas hacia league_participants.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} leagueId
 * @param {{ competitionId?: string, registeredBy?: string }} [opts]
 */
async function importCompetitionParticipantsToLeague(supabase, leagueId, opts = {}) {
  const { competitionId, registeredBy } = opts;

  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, max_participants')
    .eq('id', leagueId)
    .maybeSingle();

  if (leagueErr || !league) {
    throw new Error('Liga no encontrada');
  }

  let linksQuery = supabase
    .from('league_competitions')
    .select('competition_id')
    .eq('league_id', leagueId);

  if (competitionId) {
    linksQuery = linksQuery.eq('competition_id', competitionId);
  }

  const { data: links, error: linkErr } = await linksQuery;
  if (linkErr) {
    throw new Error(linkErr.message);
  }

  if (!links?.length) {
    if (competitionId) {
      throw new Error('La competición no pertenece a esta liga');
    }
    return { created: 0, updated: 0, skipped: 0, participants: [] };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from('league_participants')
    .select('id, name, email, vehicle_id, vehicle_model, status')
    .eq('league_id', leagueId);

  if (existingErr) {
    throw new Error(existingErr.message);
  }

  const existingIndex = buildParticipantIndex(existingRows || []);
  const candidates = new Map();
  const keyAliases = new Map();

  for (const link of links) {
    const compId = link.competition_id;

    const { data: signups, error: signupsErr } = await supabase
      .from('competition_signups')
      .select('name, email')
      .eq('competition_id', compId);

    if (signupsErr) {
      throw new Error(signupsErr.message);
    }

    const signupEmailByName = new Map();
    for (const signup of signups || []) {
      const nameKey = participantMatchKey(signup.name, null);
      if (signup.email && !signupEmailByName.has(nameKey)) {
        signupEmailByName.set(nameKey, String(signup.email).trim().toLowerCase());
      }
    }

    const { data: participants, error: partErr } = await supabase
      .from('competition_participants')
      .select('driver_name, vehicle_id, vehicle_model')
      .eq('competition_id', compId);

    if (partErr) {
      throw new Error(partErr.message);
    }

    for (const participant of participants || []) {
      const name = String(participant.driver_name || '').trim();
      if (!name) continue;

      const email = signupEmailByName.get(participantMatchKey(name, null)) || null;
      registerImportCandidate(candidates, keyAliases, {
        name,
        email,
        vehicle_id: participant.vehicle_id || null,
        vehicle_model: participant.vehicle_model || null,
      });
    }
  }

  let confirmedCount = (existingRows || []).filter((row) => row.status === 'confirmed').length;
  const pendingIndex = buildParticipantIndex([]);
  const toInsert = [];
  const toUpdate = [];
  let skipped = 0;

  for (const candidate of candidates.values()) {
    let existing =
      resolveFromIndex(existingIndex, candidate.name, candidate.email)
      || resolveFromIndex(pendingIndex, candidate.name, candidate.email);

    if (existing) {
      const updates = {};
      if (!existing.email && candidate.email) updates.email = candidate.email;
      if (!existing.vehicle_id && candidate.vehicle_id) updates.vehicle_id = candidate.vehicle_id;
      if (!existing.vehicle_model && candidate.vehicle_model) {
        updates.vehicle_model = candidate.vehicle_model;
      }

      if (existing.id) {
        if (Object.keys(updates).length > 0) {
          toUpdate.push({ id: existing.id, ...updates });
        } else {
          skipped += 1;
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    let status = 'confirmed';
    if (league.max_participants != null && confirmedCount >= league.max_participants) {
      status = 'waitlist';
    } else {
      confirmedCount += 1;
    }

    const pendingRow = {
      id: null,
      name: candidate.name,
      email: candidate.email,
      vehicle_id: candidate.vehicle_id,
      vehicle_model: candidate.vehicle_model,
      status,
    };
    const pendingKey = resolveParticipantKey(
      pendingIndex.keyAliases,
      pendingIndex.byKey,
      pendingRow.name,
      pendingRow.email,
    );
    registerStandingsEntry(pendingIndex.byKey, pendingIndex.keyAliases, pendingKey, pendingRow);

    toInsert.push({
      league_id: leagueId,
      name: candidate.name,
      email: candidate.email,
      vehicle_id: candidate.vehicle_id,
      vehicle_model: candidate.vehicle_model,
      registered_by: registeredBy || null,
      status,
    });
  }

  let createdParticipants = [];
  const updatedParticipants = [];

  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('league_participants')
      .insert(toInsert)
      .select('id, name, email, vehicle_id, vehicle_model, status');

    if (insertErr) {
      throw new Error(insertErr.message);
    }
    createdParticipants = inserted || [];
  }

  for (const update of toUpdate) {
    const { id, ...fields } = update;
    const { data: updated, error: updateErr } = await supabase
      .from('league_participants')
      .update(fields)
      .eq('id', id)
      .eq('league_id', leagueId)
      .select('id, name, email, vehicle_id, vehicle_model, status')
      .single();

    if (updateErr) {
      throw new Error(updateErr.message);
    }
    if (updated) updatedParticipants.push(updated);
  }

  return {
    created: toInsert.length,
    updated: toUpdate.length,
    skipped,
    participants: createdParticipants,
    updated_participants: updatedParticipants,
  };
}

/**
 * Sincroniza participantes confirmados de una liga a una competición.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} leagueId
 * @param {string} competitionId
 * @param {{ autoApprove?: boolean }} [opts]
 */
async function syncLeagueParticipantsToCompetition(supabase, leagueId, competitionId, opts = {}) {
  const { autoApprove = false } = opts;

  const { data: leagueParticipants, error: lpErr } = await supabase
    .from('league_participants')
    .select('*')
    .eq('league_id', leagueId)
    .eq('status', 'confirmed');

  if (lpErr) {
    throw new Error(lpErr.message);
  }

  const { data: existingSignups } = await supabase
    .from('competition_signups')
    .select('id, name, email, vehicle, vehicle_id')
    .eq('competition_id', competitionId);

  const { data: existingParticipants } = await supabase
    .from('competition_participants')
    .select('driver_name')
    .eq('competition_id', competitionId);

  const existingKeys = new Set(
    [
      ...(existingSignups || []).map((s) => participantMatchKey(s.name, s.email)),
      ...(existingParticipants || []).map((p) => participantMatchKey(p.driver_name, null)),
    ],
  );

  const toInsert = [];
  for (const lp of leagueParticipants || []) {
    const key = participantMatchKey(lp.name, lp.email);
    if (existingKeys.has(key)) continue;

    const nameOnlyKey = participantMatchKey(lp.name, null);
    if (existingKeys.has(nameOnlyKey)) continue;

    if (autoApprove) {
      const participantData = {
        competition_id: competitionId,
        driver_name: lp.name,
      };
      if (lp.vehicle_id) {
        participantData.vehicle_id = lp.vehicle_id;
      } else if (lp.vehicle_model) {
        participantData.vehicle_model = lp.vehicle_model;
      } else {
        continue;
      }

      const { error: partErr } = await supabase
        .from('competition_participants')
        .insert([participantData]);

      if (!partErr) {
        existingKeys.add(key);
        existingKeys.add(nameOnlyKey);
        toInsert.push({ type: 'participant', name: lp.name });
      }
    } else {
      toInsert.push({
        competition_id: competitionId,
        name: lp.name,
        email: lp.email,
        vehicle: lp.vehicle_model || null,
        vehicle_id: lp.vehicle_id || null,
        is_waitlist: false,
      });
      existingKeys.add(key);
      existingKeys.add(nameOnlyKey);
    }
  }

  if (toInsert.length === 0) {
    return { created: 0, signups: [], participants: [] };
  }

  if (autoApprove) {
    return {
      created: toInsert.length,
      signups: [],
      participants: toInsert,
    };
  }

  const { data: created, error: insErr } = await supabase
    .from('competition_signups')
    .insert(toInsert)
    .select('id, name, email');

  if (insErr) {
    throw new Error(insErr.message);
  }

  return {
    created: (created || []).length,
    signups: created || [],
    participants: [],
  };
}

module.exports = {
  buildParticipantIndex,
  resolveFromIndex,
  registerImportCandidate,
  importCompetitionParticipantsToLeague,
  syncLeagueParticipantsToCompetition,
};
