/**
 * Conteos baratos de vehicle_timings anidados en vehículos del dashboard.
 * Evita una query extra: /metrics ya embebe vehicle_timings por coche.
 *
 * Fecha efectiva: misma semántica que el KPI de retención
 * (`coalesce(timing_date, created_at)` vía timingEffectiveAt).
 */

const { timingEffectiveAt } = require('./timingRetentionKpi');

const STALE_WINDOW_DAYS = 30;
const QUIET_WINDOW_DAYS = 14;

function timingDateIso(timing) {
  const at = timingEffectiveAt(timing);
  return at ? at.toISOString().slice(0, 10) : '';
}

function utcMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Clave ISO week (año ISO + semana), en UTC. */
function utcIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function consecutiveWeeksWithSession(weekKeys, lastAt) {
  if (!lastAt || !weekKeys || weekKeys.size === 0) return 0;
  let count = 0;
  let cursor = lastAt;
  for (let i = 0; i < 60; i += 1) {
    if (!weekKeys.has(utcIsoWeekKey(cursor))) break;
    count += 1;
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() - 7),
    );
  }
  return count;
}

function isoDateDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Array<{ vehicle_timings?: Array<{ timing_date?: string|null, created_at?: string|null }> }>} vehicles
 * @param {{ now?: Date, windowDays?: number, quietWindowDays?: number }} [options]
 * @returns {{
 *   totalTimings: number,
 *   timingsLast30Days: number,
 *   timingsLast14Days: number,
 *   windowDays: number,
 *   quietWindowDays: number,
 * }}
 */
function countTimingActivity(
  vehicles,
  { now = new Date(), windowDays = STALE_WINDOW_DAYS, quietWindowDays = QUIET_WINDOW_DAYS } = {},
) {
  const staleCutoff = isoDateDaysAgo(windowDays, now);
  const quietCutoff = isoDateDaysAgo(quietWindowDays, now);
  let totalTimings = 0;
  let timingsInStaleWindow = 0;
  let timingsInQuietWindow = 0;

  for (const vehicle of vehicles || []) {
    const timings = vehicle?.vehicle_timings;
    if (!Array.isArray(timings)) continue;
    for (const timing of timings) {
      totalTimings += 1;
      const date = timingDateIso(timing);
      if (date && date >= staleCutoff) timingsInStaleWindow += 1;
      if (date && date >= quietCutoff) timingsInQuietWindow += 1;
    }
  }

  return {
    totalTimings,
    timingsLast30Days: timingsInStaleWindow,
    timingsLast14Days: timingsInQuietWindow,
    windowDays,
    quietWindowDays,
  };
}

/**
 * Progreso hobby del usuario: sesiones (filas vehicle_timings / TRAINING)
 * del mes calendario UTC actual vs el anterior.
 *
 * @param {Array<{ vehicle_timings?: Array<{ timing_date?: string|null, created_at?: string|null }> }>} vehicles
 * @param {{ now?: Date }} [options]
 * @returns {{
 *   sessionsThisMonth: number,
 *   sessionsLastMonth: number,
 *   lastSessionDate: string|null,
 *   daysSinceLastSession: number|null,
 *   consecutiveWeeksWithSession: number,
 * }}
 */
function countHobbyProgress(vehicles, { now = new Date() } = {}) {
  const thisMonth = utcMonthKey(now);
  const lastMonth = utcMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  let sessionsThisMonth = 0;
  let sessionsLastMonth = 0;
  let lastAt = null;
  const weekKeys = new Set();

  for (const vehicle of vehicles || []) {
    const timings = vehicle?.vehicle_timings;
    if (!Array.isArray(timings)) continue;
    for (const timing of timings) {
      const at = timingEffectiveAt(timing);
      if (!at) continue;
      const month = utcMonthKey(at);
      if (month === thisMonth) sessionsThisMonth += 1;
      else if (month === lastMonth) sessionsLastMonth += 1;
      if (!lastAt || at.getTime() > lastAt.getTime()) lastAt = at;
      weekKeys.add(utcIsoWeekKey(at));
    }
  }

  let lastSessionDate = null;
  let daysSinceLastSession = null;
  if (lastAt) {
    lastSessionDate = lastAt.toISOString().slice(0, 10);
    const lastDay = Date.UTC(lastAt.getUTCFullYear(), lastAt.getUTCMonth(), lastAt.getUTCDate());
    const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    daysSinceLastSession = Math.max(0, Math.round((nowDay - lastDay) / 86400000));
  }

  return {
    sessionsThisMonth,
    sessionsLastMonth,
    lastSessionDate,
    daysSinceLastSession,
    consecutiveWeeksWithSession: consecutiveWeeksWithSession(weekKeys, lastAt),
  };
}

module.exports = {
  isoDateDaysAgo,
  timingDateIso,
  utcMonthKey,
  countTimingActivity,
  countHobbyProgress,
  STALE_WINDOW_DAYS,
  QUIET_WINDOW_DAYS,
};
