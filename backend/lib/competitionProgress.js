/**
 * Shared competition progress payload (web JWT + sync API key).
 */
const { calculatePoints } = require('./pointsCalculator');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 * @param {{ rounds?: number; num_slots?: number }} competition
 */
async function buildCompetitionProgress(supabase, competitionId, competition) {
  const { count: participantsCount, error: partError } = await supabase
    .from('competition_participants')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', competitionId);

  if (partError) {
    throw new Error(partError.message);
  }

  let timesCount = 0;
  const timesByParticipant = {};
  const timesByRound = {};

  if (participantsCount > 0) {
    const { data: participantIds } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('competition_id', competitionId);

    const ids = participantIds?.map((p) => p.id) || [];

    if (ids.length > 0) {
      const { data: timings, error: timesError } = await supabase
        .from('competition_timings')
        .select(`
          id,
          participant_id,
          round_number,
          best_lap_time,
          total_time,
          laps,
          average_time,
          lane,
          driver,
          timing_date,
          circuit,
          penalty_seconds,
          did_not_participate,
          best_lap_timestamp,
          total_time_timestamp
        `)
        .in('participant_id', ids)
        .order('round_number', { ascending: true });

      if (!timesError && timings) {
        timesCount = timings.length;

        for (const timing of timings) {
          if (!timesByParticipant[timing.participant_id]) {
            timesByParticipant[timing.participant_id] = [];
          }
          timesByParticipant[timing.participant_id].push(timing);

          if (!timesByRound[timing.round_number]) {
            timesByRound[timing.round_number] = [];
          }
          timesByRound[timing.round_number].push(timing);
        }
      }
    }
  }

  const rounds = competition.rounds ?? 1;
  const totalRequiredTimes = participantsCount * rounds;
  const isCompleted = timesCount >= totalRequiredTimes;
  const progressPercentage =
    totalRequiredTimes > 0 ? (timesCount / totalRequiredTimes) * 100 : 0;

  const { data: rules, error: rulesError } = await supabase
    .from('competition_rules')
    .select('*')
    .eq('competition_id', competitionId);
  if (rulesError) throw new Error(rulesError.message);

  const { data: categories, error: catError } = await supabase
    .from('competition_categories')
    .select('id, name')
    .eq('competition_id', competitionId)
    .order('name', { ascending: true });
  if (catError) throw new Error(catError.message);

  const { data: fullParticipants, error: fullPartError } = await supabase
    .from('competition_participants')
    .select(`
      id,
      driver_name,
      team_name,
      vehicle_model,
      category_id,
      vehicles(model, manufacturer)
    `)
    .eq('competition_id', competitionId);
  if (fullPartError) throw new Error(fullPartError.message);

  const participantsForPoints = (fullParticipants || []).filter(
    (p) => timesByParticipant[p.id],
  );
  const allTimings = Object.values(timesByParticipant).flat();

  const { participantStats, categoryRankings, sortedParticipants } = calculatePoints({
    competition,
    participants: participantsForPoints,
    timings: allTimings,
    rules: rules || [],
    categories: categories || [],
  });

  const generalRanking = {
    category_id: null,
    category_name: 'General',
    sortedParticipants: sortedParticipants || [],
  };

  const category_rankings =
    (categoryRankings || []).length > 0
      ? [generalRanking, ...(categoryRankings || [])]
      : generalRanking.sortedParticipants.length > 0
        ? [generalRanking]
        : [];

  return {
    competition_id: competitionId,
    participants_count: participantsCount,
    rounds,
    times_registered: timesCount,
    total_required_times: totalRequiredTimes,
    times_remaining: Math.max(0, totalRequiredTimes - timesCount),
    is_completed: isCompleted,
    progress_percentage: Math.round(progressPercentage),
    times_by_round: timesByRound,
    participant_stats: participantStats,
    category_rankings,
    has_category_rules: (rules || []).some((r) => r.category_id != null),
  };
}

module.exports = { buildCompetitionProgress };
