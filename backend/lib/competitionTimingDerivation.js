/** Misma semántica que routes/competitions.js para tiempos de competición. */

function parseMmSsMmmToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;
  const [, min, sec, ms] = match.map(Number);
  return min * 60 + sec + ms / 1000;
}

function formatAverageLapSeconds(seconds) {
  const avgMinutes = Math.floor(seconds / 60);
  const avgSeconds = Math.floor(seconds % 60);
  const avgMilliseconds = Math.floor((seconds % 1) * 1000);
  return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
}

function deriveCompetitionAverageFromTotalAndLaps(total_time, laps) {
  const lapsNum = typeof laps === 'number' ? laps : parseInt(String(laps), 10);
  if (!Number.isInteger(lapsNum) || lapsNum <= 0) return null;
  const totalSec = parseMmSsMmmToSeconds(total_time);
  if (totalSec === null || totalSec <= 0) return null;
  const avgSec = totalSec / lapsNum;
  return {
    average_time: formatAverageLapSeconds(avgSec),
    average_time_timestamp: avgSec,
  };
}

module.exports = {
  parseMmSsMmmToSeconds,
  formatAverageLapSeconds,
  deriveCompetitionAverageFromTotalAndLaps,
};
