import { formatTimeDiff } from './formatTimeDiff';

/** Formatea segundos (float) a mm:ss.mmm */
export function formatTimeFromSeconds(timestamp) {
  if (timestamp === null || timestamp === undefined || Number.isNaN(Number(timestamp)) || Number(timestamp) <= 0) {
    return '—';
  }
  const totalMs = Math.round(Number(timestamp) * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/** Formatea mejor vuelta (float) a mm:ss.mmm */
export function formatBestLapFromSeconds(bestLap) {
  if (!bestLap || Number.isNaN(Number(bestLap)) || Number(bestLap) <= 0) return '—';
  return formatTimeFromSeconds(Number(bestLap));
}

/** Formatea diferencia de tiempo con signo */
export function formatGapSeconds(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const corrected = Math.round(seconds * 1000) / 1000;
  return formatTimeDiff(corrected);
}

/** Formatea penalización en segundos */
export function formatPenaltySeconds(sec) {
  if (!sec || Number(sec) <= 0) return '—';
  return `+${Number(sec).toFixed(3)} s`;
}

/** Tiempo de ronda ajustado (time_timestamp + penalty) */
export function roundAdjustedSeconds(round) {
  if (!round || round.did_not_participate) return null;
  const base = round.time_timestamp;
  if (base == null || base <= 0) return null;
  return base + (Number(round.penalty_seconds) || 0);
}
