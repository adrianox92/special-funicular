import { parseLapTimeToSeconds } from './averageLapTime';

export const MONTH_WINDOW_DAYS = 30;

/**
 * Mejor vuelta en segundos desde una fila de timing o la respuesta de POST /timings.
 * Prioriza best_lap_timestamp; si no hay, parsea best_lap_time (mm:ss.mmm).
 * @param {object|null|undefined} row
 * @returns {number|null}
 */
export function bestLapSecondsFromTiming(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.best_lap_timestamp != null && Number(row.best_lap_timestamp) > 0) {
    const n = Number(row.best_lap_timestamp);
    return Number.isFinite(n) ? n : null;
  }
  const parsed = parseLapTimeToSeconds(row.best_lap_time);
  if (parsed != null) return parsed;
  const n = Number(row.best_lap_time);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Delta actual − referencia (negativo = más rápido).
 * @param {number|null|undefined} currentSeconds
 * @param {number|null|undefined} referenceSeconds
 * @returns {number|null}
 */
export function deltaVsReference(currentSeconds, referenceSeconds) {
  if (currentSeconds == null || referenceSeconds == null) return null;
  if (!Number.isFinite(currentSeconds) || !Number.isFinite(referenceSeconds)) return null;
  return Math.round((currentSeconds - referenceSeconds) * 1000) / 1000;
}

export function normalizeLane(lane) {
  if (lane == null) return '';
  return String(lane).trim();
}

function isHeatSession(row) {
  return String(row?.session_type || '').toUpperCase() === 'HEAT';
}

function sameCircuit(row, current) {
  const cid = current?.circuit_id;
  if (cid != null && String(cid) !== '' && row?.circuit_id != null && String(row.circuit_id) !== '') {
    return String(row.circuit_id) === String(cid);
  }
  const name = current?.circuit;
  if (name && row?.circuit) return String(row.circuit) === String(name);
  return false;
}

function timingDateAtNoon(row) {
  const raw = row?.timing_date;
  if (!raw) return null;
  const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function recencyMs(row) {
  if (row?.created_at) {
    const t = Date.parse(row.created_at);
    if (Number.isFinite(t)) return t;
  }
  const d = timingDateAtNoon(row);
  return d ? d.getTime() : 0;
}

function minBest(rows) {
  let min = null;
  for (const row of rows) {
    const seconds = bestLapSecondsFromTiming(row);
    if (seconds == null) continue;
    if (min == null || seconds < min.seconds) min = { seconds, row };
  }
  return min;
}

function packRef(best, currentSeconds) {
  if (!best) return null;
  return {
    seconds: best.seconds,
    delta: deltaVsReference(currentSeconds, best.seconds),
    isNewBest: currentSeconds != null && currentSeconds <= best.seconds,
  };
}

function extrasFromCurrent(current) {
  const currentBestSeconds = bestLapSecondsFromTiming(current);
  const consistencyRaw = current?.consistency_score;
  const consistencyScore =
    consistencyRaw != null && consistencyRaw !== '' && Number.isFinite(Number(consistencyRaw))
      ? Number(consistencyRaw)
      : null;
  const worstRaw = current?.worst_lap_timestamp;
  const worstLapSeconds =
    worstRaw != null && Number(worstRaw) > 0 && Number.isFinite(Number(worstRaw))
      ? Number(worstRaw)
      : null;
  return { currentBestSeconds, consistencyScore, worstLapSeconds };
}

function emptyComparisons(extras, source, isPersonalBest) {
  return {
    ...extras,
    source,
    hasCircuitHistory: false,
    isPersonalBest,
    circuitPb: null,
    lanePb: null,
    monthPb: null,
    previousSession: null,
  };
}

/**
 * Comparativas para el resumen de Nueva sesión (mismo vehículo).
 * `history === null/undefined` usa sync_meta del POST (no bloquea si falla el GET).
 * `history` array (aunque vacío) es la fuente de verdad y excluye HEAT y la fila actual.
 *
 * @param {{
 *   current?: object,
 *   history?: object[]|null,
 *   syncMeta?: object|null,
 *   now?: Date,
 * }} [opts]
 */
export function buildSessionSummaryComparisons({
  current = {},
  history,
  syncMeta = {},
  now = new Date(),
} = {}) {
  const extras = extrasFromCurrent(current);
  const { currentBestSeconds } = extras;
  const historyLoaded = Array.isArray(history);
  const currentId = current?.id;

  if (historyLoaded) {
    const priors = history.filter((row) => {
      if (!row) return false;
      if (currentId != null && row.id != null && String(row.id) === String(currentId)) return false;
      if (isHeatSession(row)) return false;
      if (!sameCircuit(row, current)) return false;
      return bestLapSecondsFromTiming(row) != null;
    });

    const circuitBest = minBest(priors);
    const circuitPb = packRef(circuitBest, currentBestSeconds);
    const lane = normalizeLane(current?.lane);
    const lanePriors = lane ? priors.filter((row) => normalizeLane(row.lane) === lane) : [];
    const lanePacked = lane ? packRef(minBest(lanePriors), currentBestSeconds) : null;
    const lanePb =
      lanePacked && circuitPb && lanePacked.seconds === circuitPb.seconds ? null : lanePacked;

    const cutoff = new Date(now.getTime());
    cutoff.setDate(cutoff.getDate() - MONTH_WINDOW_DAYS);
    const monthPriors = priors.filter((row) => {
      const d = timingDateAtNoon(row);
      return d != null && d >= cutoff;
    });
    const monthBest = minBest(monthPriors);
    let monthPb = null;
    if (priors.length > 0) {
      monthPb = monthBest ? packRef(monthBest, currentBestSeconds) : { empty: true };
    }

    let previous = null;
    for (const row of priors) {
      if (!previous || recencyMs(row) > recencyMs(previous)) previous = row;
    }
    const previousSeconds = previous ? bestLapSecondsFromTiming(previous) : null;
    const previousSession =
      previous && previousSeconds != null
        ? {
            ...packRef({ seconds: previousSeconds }, currentBestSeconds),
            timingDate: previous.timing_date || null,
          }
        : null;

    return {
      ...extras,
      source: 'history',
      hasCircuitHistory: priors.length > 0,
      isPersonalBest: circuitPb == null || circuitPb.isNewBest === true,
      circuitPb,
      lanePb: lane && lanePriors.length > 0 ? lanePb : null,
      monthPb,
      previousSession,
    };
  }

  const prevRaw = syncMeta?.previous_best_lap_seconds;
  const prev =
    prevRaw != null && Number.isFinite(Number(prevRaw)) && Number(prevRaw) > 0 ? Number(prevRaw) : null;
  const deltaRaw = syncMeta?.delta_vs_pb_seconds;
  const delta =
    deltaRaw != null && Number.isFinite(Number(deltaRaw))
      ? Number(deltaRaw)
      : deltaVsReference(currentBestSeconds, prev);

  if (prev == null) {
    const firstSession = syncMeta?.is_personal_best !== false;
    return emptyComparisons(extras, 'none', firstSession && currentBestSeconds != null);
  }

  const circuitPb = {
    seconds: prev,
    delta,
    isNewBest:
      syncMeta?.is_personal_best === true || (currentBestSeconds != null && currentBestSeconds <= prev),
  };

  return {
    ...extras,
    source: 'sync_meta',
    hasCircuitHistory: true,
    isPersonalBest: circuitPb.isNewBest,
    circuitPb,
    lanePb: null,
    monthPb: null,
    previousSession: null,
  };
}
