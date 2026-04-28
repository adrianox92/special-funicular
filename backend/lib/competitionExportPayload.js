'use strict';

const { calculatePoints } = require('./pointsCalculator');

const COMPETITION_EXPORT_SELECT = 'id,name,circuit_name,rounds,num_slots,created_at,public_slug';

/**
 * Carga participantes, tiempos y reglas para una competición.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 */
async function fetchParticipantsTimingsAndRules(supabase, competitionId) {
  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select(`
      *,
      vehicles(model, manufacturer)
    `)
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: true });

  if (partError) {
    return { error: partError };
  }

  const list = participants || [];
  const participantIds = list.map((p) => p.id);

  let timings = [];
  if (participantIds.length > 0) {
    const { data: tdata, error: timError } = await supabase
      .from('competition_timings')
      .select('*')
      .in('participant_id', participantIds)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (timError) {
      return { error: timError };
    }
    timings = tdata || [];
  }

  const { data: rules, error: rulesError } = await supabase
    .from('competition_rules')
    .select('*')
    .eq('competition_id', competitionId);

  if (rulesError) {
    return { error: rulesError };
  }

  return {
    participants: list,
    timings,
    rules: rules || [],
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, rounds: number }} competition — fila mínima con `rounds`
 * @returns {Promise<{ error?: import('@supabase/postgrest-js').PostgrestError|Error, payload?: object }>}
 */
async function buildExportPayload(supabase, competition) {
  const { participants, timings, rules, error } = await fetchParticipantsTimingsAndRules(
    supabase,
    competition.id
  );
  if (error) {
    return { error };
  }

  const pointsResult = calculatePoints({
    competition,
    participants,
    timings,
    rules,
  });

  return {
    payload: {
      competition,
      participants,
      timings,
      rules,
      pointsByParticipant: pointsResult.pointsByParticipant,
      participantStats: pointsResult.participantStats,
      sortedParticipants: pointsResult.sortedParticipants,
    },
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 */
async function loadCompetitionExportById(supabase, competitionId) {
  const { data: competition, error } = await supabase
    .from('competitions')
    .select(COMPETITION_EXPORT_SELECT)
    .eq('id', competitionId)
    .maybeSingle();

  if (error) {
    return { error };
  }
  if (!competition) {
    const e = new Error('Competición no encontrada');
    e.statusCode = 404;
    return { error: e };
  }
  const built = await buildExportPayload(supabase, competition);
  if (built.error) {
    return { error: built.error };
  }
  return { competition, payload: built.payload };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} publicSlug — `public_slug`
 */
async function loadCompetitionExportByPublicSlug(supabase, publicSlug) {
  const { data: competition, error } = await supabase
    .from('competitions')
    .select(COMPETITION_EXPORT_SELECT)
    .eq('public_slug', publicSlug)
    .maybeSingle();

  if (error) {
    return { error };
  }
  if (!competition) {
    const e = new Error('Competición no encontrada');
    e.statusCode = 404;
    return { error: e };
  }

  const built = await buildExportPayload(supabase, competition);
  if (built.error) {
    return { error: built.error };
  }
  return { competition, payload: built.payload };
}

module.exports = {
  COMPETITION_EXPORT_SELECT,
  fetchParticipantsTimingsAndRules,
  buildExportPayload,
  loadCompetitionExportById,
  loadCompetitionExportByPublicSlug,
};
