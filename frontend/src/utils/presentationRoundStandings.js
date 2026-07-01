import { roundAdjustedSeconds } from './presentationFormatters';

/**
 * Clasificación de una ronda a partir del payload `/presentation` (campo rounds[]).
 * @param {Array<object>} participants — participantes con rounds[]
 * @param {number} roundNumber — 1-based
 * @returns {{ isComplete: boolean, leaderAdjustedSeconds: number|null, rows: Array }}
 */
export function buildPresentationRoundLeaderboard(participants, roundNumber) {
  const participantIds = participants.map((p) => p.id);

  const pairRows = participants.map((participant) => {
    const round = (participant.rounds || []).find((r) => r.round_number === roundNumber) || null;
    return { participant, round };
  });

  const registeredCount = pairRows.filter((r) => r.round != null && !r.round.did_not_participate && r.round.time_timestamp > 0).length;
  const dnpCount = pairRows.filter((r) => r.round?.did_not_participate).length;
  const isComplete =
    participantIds.length > 0 &&
    registeredCount + dnpCount === participantIds.length;

  const raced = pairRows.filter(
    (r) => r.round && !r.round.did_not_participate && r.round.time_timestamp > 0,
  );
  const sortedRaced = raced.slice().sort((a, b) => {
    const sa = roundAdjustedSeconds(a.round);
    const sb = roundAdjustedSeconds(b.round);
    const fa = typeof sa === 'number' ? sa : Infinity;
    const fb = typeof sb === 'number' ? sb : Infinity;
    if (fa !== fb) return fa - fb;
    const ix = participantIds.indexOf(a.participant.id);
    const iy = participantIds.indexOf(b.participant.id);
    return ix - iy;
  });

  const leaderAdjustedSeconds =
    sortedRaced.length > 0 ? roundAdjustedSeconds(sortedRaced[0].round) : null;

  const out = [];
  sortedRaced.forEach((r, idx) => {
    const adj = roundAdjustedSeconds(r.round);
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
      round: r.round,
      position: idx + 1,
      leaderGapSeconds,
    });
  });

  const sortByOrder = (rows) =>
    rows.slice().sort((a, b) => {
      const ia = participantIds.indexOf(a.participant.id);
      const ib = participantIds.indexOf(b.participant.id);
      return ia - ib;
    });

  sortByOrder(pairRows.filter((r) => r.round?.did_not_participate)).forEach((r) => {
    out.push({
      kind: 'np',
      participant: r.participant,
      round: r.round,
      position: null,
      leaderGapSeconds: null,
    });
  });

  sortByOrder(pairRows.filter((r) => !r.round || (!r.round.did_not_participate && !(r.round.time_timestamp > 0)))).forEach((r) => {
    if (r.round?.did_not_participate) return;
    out.push({
      kind: 'missing',
      participant: r.participant,
      round: r.round,
      position: null,
      leaderGapSeconds: null,
    });
  });

  return { isComplete, leaderAdjustedSeconds, rows: out };
}
