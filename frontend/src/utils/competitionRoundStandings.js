/** Placeholder cuando no hay tiempo válido en una ronda. */
export const ROUND_TIME_PLACEHOLDER = '--:--.---';

/**
 * Parsea tiempo MM:SS.mmm del cronómetro a segundos.
 * @param {string|null|undefined} str
 * @returns {number}
 */
export function timingTotalSeconds(str) {
  if (!str) return 0;
  const match = String(str).match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, min, sec, ms] = match.map(Number);
  return min * 60 + sec + ms / 1000;
}

/**
 * Tiempo total de ronda ajustado (cronómetro + penalización), o null si NP / sin datos.
 * @param {object|null|undefined} timing
 * @returns {number|null}
 */
export function timingAdjustedSeconds(timing) {
  if (!timing || timing.did_not_participate) return null;
  return timingTotalSeconds(timing.total_time) + (Number(timing.penalty_seconds) || 0);
}

/** Mejor vuelta válida (excluye 00:00.000 ausente como en backend). */
export function usableBestLapSeconds(str) {
  const s = timingTotalSeconds(str);
  return s > 0 ? s : null;
}

/**
 * @typedef {object} RoundLeaderRow
 * @property {'raced'|'np'|'missing'} kind
 * @property {object} participant — fila participation del API status
 * @property {object|null|undefined} timing — competition_timing o null si falta registro en la ronda
 * @property {number|null} [position] — 1-based entre los que sí corrieron
 * @property {number|null} [leaderGapSeconds] — diferencia vs líder (0 para el líder)
 */

/**
 * Orden estable por índice original en lista de participantes (evita orden alfabético implícito).
 * @param {Array<{ participant: object, timing?: object|null }>} pairRows
 * @param {string} participantIdsInOrder — ids en orden appearance
 */
function sortByParticipantOrder(pairRows, participantIdsInOrder) {
  const idx = new Map(participantIdsInOrder.map((id, i) => [String(id), i]));
  return pairRows.slice().sort((a, b) => {
    const ia = idx.get(String(a.participant.participant_id)) ?? 999;
    const ib = idx.get(String(b.participant.participant_id)) ?? 999;
    return ia - ib;
  });
}

/**
 * Clasificación de una ronda a partir del payload público `/status`.
 * @param {Array<object>} sortedParticipants — `participants` del API (cada uno con `timings` y `participant_id`)
 * @param {number} roundNumber — 1-based
 * @returns {{ isComplete: boolean, leaderAdjustedSeconds: number|null, rows: RoundLeaderRow[] }}
 */
export function buildRoundLeaderboard(sortedParticipants, roundNumber) {
  const participantIds = sortedParticipants.map((p) => p.participant_id);

  const pairRows = sortedParticipants.map((participant) => {
    const timing = (participant.timings || []).find((t) => t.round_number === roundNumber) || null;
    return { participant, timing };
  });

  const registeredCount = pairRows.filter((r) => r.timing != null).length;
  const isComplete = participantIds.length > 0 && registeredCount === participantIds.length;

  const raced = pairRows.filter((r) => r.timing && !r.timing.did_not_participate);
  const sortedRaced = raced.slice().sort((a, b) => {
    const sa = timingAdjustedSeconds(a.timing);
    const sb = timingAdjustedSeconds(b.timing);
    const fa = typeof sa === 'number' ? sa : Infinity;
    const fb = typeof sb === 'number' ? sb : Infinity;
    if (fa !== fb) return fa - fb;
    const ix = participantIds.indexOf(a.participant.participant_id);
    const iy = participantIds.indexOf(b.participant.participant_id);
    return ix - iy;
  });

  const leaderAdjustedSeconds =
    sortedRaced.length > 0 ? timingAdjustedSeconds(sortedRaced[0].timing) : null;

  /** @type {RoundLeaderRow[]} */
  const out = [];
  sortedRaced.forEach((r, idx) => {
    const adj = timingAdjustedSeconds(r.timing);
    let leaderGapSeconds = null;
    if (
      leaderAdjustedSeconds != null &&
      typeof adj === 'number' &&
      typeof leaderAdjustedSeconds === 'number'
    ) {
      leaderGapSeconds = adj - leaderAdjustedSeconds;
    }
    out.push({
      kind: 'raced',
      participant: r.participant,
      timing: r.timing,
      position: idx + 1,
      leaderGapSeconds,
    });
  });

  const npRows = sortByParticipantOrder(
    pairRows.filter((r) => r.timing?.did_not_participate),
    participantIds.map(String)
  );
  npRows.forEach((r) => {
    out.push({
      kind: 'np',
      participant: r.participant,
      timing: r.timing,
      position: null,
      leaderGapSeconds: null,
    });
  });

  const missingRows = sortByParticipantOrder(
    pairRows.filter((r) => !r.timing),
    participantIds.map(String)
  );
  missingRows.forEach((r) => {
    out.push({
      kind: 'missing',
      participant: r.participant,
      timing: null,
      position: null,
      leaderGapSeconds: null,
    });
  });

  return { isComplete, leaderAdjustedSeconds, rows: out };
}
