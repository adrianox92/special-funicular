/**
 * @param {Array<{lap_number?: number, time_seconds?: number, lap_time_seconds?: number}>} lapTimes
 * @returns {{ consistency_score?: number, worst_lap_timestamp?: number } | null}
 */
function calculateConsistencyFromLaps(lapTimes) {
  const times = lapTimes
    .map((l) => l.time_seconds ?? l.lap_time_seconds)
    .filter((t) => typeof t === 'number' && t > 0);
  if (times.length < 3) return null;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = mean > 0 ? (stdDev / mean) * 100 : null;
  const worstLap = Math.max(...times);
  return {
    consistency_score: consistencyScore != null ? Math.round(consistencyScore * 100) / 100 : null,
    worst_lap_timestamp: worstLap,
  };
}

/** Formato MM:SS.mmm usado en la app */
function formatSecondsToLapTime(s) {
  if (s == null || !Number.isFinite(Number(s))) return null;
  const n = Number(s);
  const mins = Math.floor(n / 60);
  const secs = n - mins * 60;
  const whole = Math.floor(secs);
  const ms = Math.round((secs - whole) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

module.exports = {
  calculateConsistencyFromLaps,
  formatSecondsToLapTime,
};
