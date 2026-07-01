const { getServiceClient } = require('./supabaseClients');
const { fetchUserMetadata } = require('./notifier');
const { evaluateGoalProgress } = require('./trainingGoals');
const { bestLapSecondsFromTimingRow } = require('./personalBest');
const { formatSecondsToLapTime } = require('./timingUtils');
const { resolveStaleDaysThreshold } = require('./userPreferences');

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Construye resumen semanal para un usuario.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} userId
 */
async function buildWeeklyDigestForUser(admin, userId) {
  const since = daysAgoIso(7);

  const { data: vehicles } = await admin.from('vehicles').select('id, model, manufacturer').eq('user_id', userId);
  const vehicleIds = (vehicles || []).map((v) => v.id);
  const vehicleMap = Object.fromEntries((vehicles || []).map((v) => [v.id, v]));

  let sessions = [];
  if (vehicleIds.length > 0) {
    const { data: timings } = await admin
      .from('vehicle_timings')
      .select('id, vehicle_id, circuit_id, circuit, lane, timing_date, best_lap_time, best_lap_timestamp, laps, guided_session, consistency_score')
      .in('vehicle_id', vehicleIds)
      .gte('timing_date', since)
      .order('timing_date', { ascending: false });
    sessions = timings || [];
  }

  const { data: goals } = await admin
    .from('training_goals')
    .select('*, vehicles(model, manufacturer), circuits(name)')
    .eq('user_id', userId)
    .eq('active', true);

  const goalProgress = [];
  for (const goal of goals || []) {
    const { data: vehicleTimings } = await admin
      .from('vehicle_timings')
      .select('id, circuit_id, lane, best_lap_time, best_lap_timestamp, consistency_score, timing_date')
      .eq('vehicle_id', goal.vehicle_id)
      .order('timing_date', { ascending: false })
      .limit(50);
    const progress = evaluateGoalProgress(goal, vehicleTimings || []);
    goalProgress.push({
      id: goal.id,
      goal_type: goal.goal_type,
      target_value: Number(goal.target_value),
      achieved_at: goal.achieved_at,
      vehicle: goal.vehicles,
      circuit: goal.circuits?.name,
      lane: goal.lane,
      progressPct: progress.progressPct,
      currentValue: progress.currentValue,
      achieved: progress.achieved || goal.achieved_at != null,
    });
  }

  const guidedSessions = sessions.filter((s) => s.guided_session != null);

  const staleDays = resolveStaleDaysThreshold(await fetchUserMetadata(userId));
  const staleCutoff = daysAgoIso(staleDays);
  const { data: vehicleRows } = await admin.from('vehicles').select('id').eq('user_id', userId);
  let maintenancePending = 0;
  for (const v of vehicleRows || []) {
    const { data: lastMaint } = await admin
      .from('vehicle_maintenance_log')
      .select('performed_at')
      .eq('vehicle_id', v.id)
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(1);
    const last = lastMaint?.[0]?.performed_at;
    if (!last || String(last).slice(0, 10) <= staleCutoff) {
      maintenancePending += 1;
    }
  }

  const pbs = [];
  for (const s of sessions) {
    const sec = bestLapSecondsFromTimingRow(s);
    if (sec == null) continue;
    const { data: prior } = await admin
      .from('vehicle_timings')
      .select('best_lap_timestamp, best_lap_time')
      .eq('vehicle_id', s.vehicle_id)
      .eq('circuit_id', s.circuit_id || null)
      .lt('timing_date', s.timing_date)
      .limit(20);
    let prevBest = null;
    for (const p of prior || []) {
      const ps = bestLapSecondsFromTimingRow(p);
      if (ps != null && (prevBest == null || ps < prevBest)) prevBest = ps;
    }
    if (prevBest != null && sec < prevBest - 0.001) {
      const v = vehicleMap[s.vehicle_id];
      pbs.push({
        vehicle: v ? `${v.manufacturer} ${v.model}`.trim() : 'Vehículo',
        circuit: s.circuit,
        lane: s.lane,
        time: formatSecondsToLapTime(sec),
        improvement: (prevBest - sec).toFixed(3),
      });
    }
  }

  return {
    weekKey: isoWeekKey(),
    sessionCount: sessions.length,
    guidedCount: guidedSessions.length,
    newPbs: pbs.slice(0, 5),
    goals: goalProgress.slice(0, 8),
    maintenancePending,
    sessionsSample: sessions.slice(0, 5).map((s) => ({
      date: s.timing_date,
      circuit: s.circuit,
      laps: s.laps,
      best: s.best_lap_time,
    })),
  };
}

/**
 * Usuarios elegibles hoy (día de semana + digest activado).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {number} dayOfWeek 0=domingo … 6=sábado
 * @param {boolean} forceAll - ignorar día y last_sent
 */
async function listEligibleDigestUsers(admin, dayOfWeek, forceAll = false) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const users = data?.users || [];
  return users.filter((u) => {
    const meta = u.user_metadata || {};
    if (meta.weekly_digest_enabled !== true) return false;
    if (!forceAll) {
      const prefDay = meta.weekly_digest_day != null ? Number(meta.weekly_digest_day) : 1;
      if (Number.isFinite(prefDay) && prefDay !== dayOfWeek) return false;
      const lastSent = meta.last_weekly_digest_sent_at;
      if (lastSent && isoWeekKey(new Date(lastSent)) === isoWeekKey()) return false;
    }
    return true;
  });
}

/**
 * Ejecuta envío semanal (todos los elegibles o uno).
 * @param {{ force?: boolean, userId?: string }} opts
 */
async function runWeeklyDigest(opts = {}) {
  const admin = getServiceClient();
  if (!admin) throw new Error('Service role no disponible');

  const force = opts.force === true;
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  let users = [];
  if (opts.userId) {
    const { data, error } = await admin.auth.admin.getUserById(opts.userId);
    if (error || !data?.user) throw new Error('Usuario no encontrado');
    users = [data.user];
  } else {
    users = await listEligibleDigestUsers(admin, dayOfWeek, force);
  }

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const user of users) {
    try {
      if (!force && opts.userId == null) {
        const { data: recentLog } = await admin
          .from('digest_send_log')
          .select('id, sent_at')
          .eq('user_id', user.id)
          .eq('digest_type', 'weekly')
          .gte('sent_at', daysAgoIso(6))
          .limit(1);
        if (recentLog?.length) {
          results.skipped += 1;
          continue;
        }
      }

      const digest = await buildWeeklyDigestForUser(admin, user.id);
      const { sendWeeklyDigestNotification } = require('./notifier');
      await sendWeeklyDigestNotification(user.id, digest);

      const sentAt = new Date().toISOString();
      await admin.from('digest_send_log').insert([{ user_id: user.id, digest_type: 'weekly', sent_at: sentAt }]);
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, last_weekly_digest_sent_at: sentAt },
      });

      results.sent += 1;
    } catch (e) {
      results.errors.push({ userId: user.id, message: e.message });
    }
  }

  return results;
}

module.exports = {
  buildWeeklyDigestForUser,
  runWeeklyDigest,
  isoWeekKey,
};
