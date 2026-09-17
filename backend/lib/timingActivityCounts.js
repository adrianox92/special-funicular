/**
 * Conteos baratos de vehicle_timings anidados en vehículos del dashboard.
 * Evita una query extra: /metrics ya embebe vehicle_timings por coche.
 */

const STALE_WINDOW_DAYS = 30;
const QUIET_WINDOW_DAYS = 14;

function isoDateDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Array<{ vehicle_timings?: Array<{ timing_date?: string|null }> }>} vehicles
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
      const date = timing?.timing_date ? String(timing.timing_date).slice(0, 10) : '';
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

module.exports = {
  isoDateDaysAgo,
  countTimingActivity,
  STALE_WINDOW_DAYS,
  QUIET_WINDOW_DAYS,
};
