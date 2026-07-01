const { bestLapSecondsFromTimingRow } = require('./personalBest');
const { resolveBaselineTimings, sortTimingsByBestLap } = require('./syncTimingsQuery');

/**
 * Evalúa progreso de una meta frente a timings recientes del mismo contexto.
 * @param {object} goal - fila training_goals
 * @param {object[]} timings - vehicle_timings del usuario (mismo vehículo)
 * @returns {{ progressPct: number, currentValue: number|null, achieved: boolean, label: string }}
 */
function evaluateGoalProgress(goal, timings) {
  const filtered = (timings || []).filter((t) => {
    if (t.circuit_id !== goal.circuit_id) return false;
    if (goal.lane != null && String(goal.lane).trim() !== '') {
      return String(t.lane ?? '') === String(goal.lane);
    }
    return true;
  });

  if (goal.goal_type === 'lap_time') {
    const sorted = sortTimingsByBestLap(filtered);
    const best = sorted[0];
    const current = best ? bestLapSecondsFromTimingRow(best) : null;
    const target = Number(goal.target_value);
    if (current == null || !Number.isFinite(target) || target <= 0) {
      return { progressPct: 0, currentValue: current, achieved: false, label: 'lap_time' };
    }
    const achieved = current <= target;
    const baseline = current > target ? current : target * 1.1;
    const progressPct = achieved ? 100 : Math.max(0, Math.min(99, ((baseline - current) / (baseline - target)) * 100));
    return { progressPct: Math.round(progressPct), currentValue: current, achieved, label: 'lap_time' };
  }

  if (goal.goal_type === 'consistency') {
    const withScore = filtered
      .map((t) => (t.consistency_score != null ? Number(t.consistency_score) : null))
      .filter((v) => v != null && !Number.isNaN(v));
    const current = withScore.length
      ? withScore.reduce((a, b) => a + b, 0) / withScore.length
      : null;
    const target = Number(goal.target_value);
    if (current == null || !Number.isFinite(target)) {
      return { progressPct: 0, currentValue: current, achieved: false, label: 'consistency' };
    }
    const achieved = current <= target;
    const worst = Math.max(current, target * 1.5, 20);
    const progressPct = achieved ? 100 : Math.max(0, Math.min(99, ((worst - current) / (worst - target)) * 100));
    return { progressPct: Math.round(progressPct), currentValue: current, achieved, label: 'consistency' };
  }

  return { progressPct: 0, currentValue: null, achieved: false, label: goal.goal_type };
}

/**
 * Marca metas activas como logradas si el timing recién insertado las cumple.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {object} timing - fila vehicle_timings insertada
 */
async function checkAndAchieveGoalsAfterTimingInsert(supabase, userId, timing) {
  if (!timing?.vehicle_id || !timing?.circuit_id) return;

  const { data: goals, error } = await supabase
    .from('training_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('vehicle_id', timing.vehicle_id)
    .eq('circuit_id', timing.circuit_id)
    .eq('active', true)
    .is('achieved_at', null);

  if (error || !goals?.length) return;

  const { data: allTimings } = await supabase
    .from('vehicle_timings')
    .select('id, circuit_id, lane, best_lap_time, best_lap_timestamp, consistency_score, timing_date')
    .eq('vehicle_id', timing.vehicle_id)
    .order('timing_date', { ascending: false })
    .limit(100);

  const toAchieve = [];
  for (const goal of goals) {
    if (goal.lane != null && String(goal.lane).trim() !== '' && String(timing.lane ?? '') !== String(goal.lane)) {
      continue;
    }
    const progress = evaluateGoalProgress(goal, allTimings || []);
    if (progress.achieved) {
      toAchieve.push(goal.id);
    }
  }

  if (toAchieve.length === 0) return;

  const now = new Date().toISOString();
  await supabase
    .from('training_goals')
    .update({ achieved_at: now, updated_at: now })
    .in('id', toAchieve);
}

module.exports = {
  evaluateGoalProgress,
  checkAndAchieveGoalsAfterTimingInsert,
  resolveBaselineTimings,
  sortTimingsByBestLap,
};
