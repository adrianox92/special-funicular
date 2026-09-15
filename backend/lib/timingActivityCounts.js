/**
 * Conteos baratos de vehicle_timings anidados en vehículos del dashboard.
 * Evita una query extra: /metrics ya embebe vehicle_timings por coche.
 */

function isoDateDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Array<{ vehicle_timings?: Array<{ timing_date?: string|null }> }>} vehicles
 * @param {{ now?: Date, windowDays?: number }} [options]
 * @returns {{ totalTimings: number, timingsLast30Days: number, windowDays: number }}
 */
function countTimingActivity(vehicles, { now = new Date(), windowDays = 30 } = {}) {
  const cutoff = isoDateDaysAgo(windowDays, now);
  let totalTimings = 0;
  let timingsInWindow = 0;

  for (const vehicle of vehicles || []) {
    const timings = vehicle?.vehicle_timings;
    if (!Array.isArray(timings)) continue;
    for (const timing of timings) {
      totalTimings += 1;
      const date = timing?.timing_date ? String(timing.timing_date).slice(0, 10) : '';
      if (date && date >= cutoff) timingsInWindow += 1;
    }
  }

  return {
    totalTimings,
    timingsLast30Days: timingsInWindow,
    windowDays,
  };
}

module.exports = {
  isoDateDaysAgo,
  countTimingActivity,
};
