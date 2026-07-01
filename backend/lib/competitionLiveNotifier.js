'use strict';

const {
  calculatePoints,
  lapTimeStringToSeconds,
  isUsableBestLapTimeString,
} = require('./pointsCalculator');
const { sendCompetitionLiveNotification } = require('./notifier');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 */
async function loadCompetitionStandingsContext(supabase, competitionId) {
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('id, name, rounds, organizer, status')
    .eq('id', competitionId)
    .single();

  if (compError || !competition) return null;

  const { data: participants } = await supabase
    .from('competition_participants')
    .select(`
      id,
      driver_name,
      team_name,
      vehicle_model,
      category_id,
      vehicles(model, manufacturer)
    `)
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: true });

  const { data: rules } = await supabase
    .from('competition_rules')
    .select('*')
    .eq('competition_id', competitionId);

  const { data: categories } = await supabase
    .from('competition_categories')
    .select('id, name')
    .eq('competition_id', competitionId)
    .order('name', { ascending: true });

  const participantIds = (participants || []).map((p) => p.id).filter(Boolean);
  let timings = [];
  if (participantIds.length > 0) {
    const { data: timingRows } = await supabase
      .from('competition_timings')
      .select('*')
      .in('participant_id', participantIds);
    timings = timingRows || [];
  }

  return {
    competition,
    participants: participants || [],
    timings,
    rules: rules || [],
    categories: categories || [],
  };
}

/**
 * @param {object} ctx
 * @returns {{ leader: { id: string, name: string } | null, globalBestLap: { seconds: number, time: string, driverName: string } | null }}
 */
function snapshotFromContext(ctx) {
  const { sortedParticipants } = calculatePoints({
    competition: ctx.competition,
    participants: ctx.participants,
    timings: ctx.timings,
    rules: ctx.rules,
    categories: ctx.categories,
  });

  const leaderRow = sortedParticipants?.[0];
  const leader =
    leaderRow && (leaderRow.participant_id || leaderRow.id)
      ? {
          id: leaderRow.participant_id || leaderRow.id,
          name: leaderRow.driver_name || 'Piloto',
        }
      : null;

  let globalBestLap = null;
  for (const timing of ctx.timings) {
    if (timing.did_not_participate) continue;
    if (!isUsableBestLapTimeString(timing.best_lap_time)) continue;
    const sec = lapTimeStringToSeconds(timing.best_lap_time);
    if (sec == null) continue;
    if (globalBestLap == null || sec < globalBestLap.seconds) {
      const participant = ctx.participants.find((p) => p.id === timing.participant_id);
      globalBestLap = {
        seconds: sec,
        time: timing.best_lap_time,
        driverName: participant?.driver_name || timing.driver || 'Piloto',
      };
    }
  }

  return { leader, globalBestLap };
}

/**
 * Tras crear/actualizar un tiempo, notifica al organizador si cambió el líder o la mejor vuelta global.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 * @param {object} competition
 * @param {{ beforeCtx?: object|null, triggerDriverName?: string }} [options]
 */
async function notifyCompetitionLiveEventsAfterTimingChange(
  supabase,
  competitionId,
  competition,
  options = {},
) {
  try {
    const organizerId = competition?.organizer;
    if (!organizerId) return;

    const afterCtx = await loadCompetitionStandingsContext(supabase, competitionId);
    if (!afterCtx) return;

    const after = snapshotFromContext(afterCtx);
    let before = null;

    if (options.beforeCtx) {
      before = snapshotFromContext(options.beforeCtx);
    }

    const competitionName = afterCtx.competition.name || 'Competición';
    const tasks = [];

    if (
      before?.leader?.id &&
      after.leader?.id &&
      before.leader.id !== after.leader.id
    ) {
      tasks.push(
        sendCompetitionLiveNotification(organizerId, {
          type: 'leader_change',
          competitionName,
          driverName: after.leader.name,
          previousLeaderName: before.leader.name,
        }),
      );
    }

    if (
      after.globalBestLap &&
      (before?.globalBestLap == null ||
        after.globalBestLap.seconds < before.globalBestLap.seconds)
    ) {
      tasks.push(
        sendCompetitionLiveNotification(organizerId, {
          type: 'new_pb',
          competitionName,
          driverName: after.globalBestLap.driverName,
          bestLapTime: after.globalBestLap.time,
          previousBestLapTime: before?.globalBestLap?.time || null,
          triggerDriverName: options.triggerDriverName || null,
        }),
      );
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  } catch (e) {
    console.warn('[competitionLiveNotifier]', e.message);
  }
}

module.exports = {
  loadCompetitionStandingsContext,
  snapshotFromContext,
  notifyCompetitionLiveEventsAfterTimingChange,
};
