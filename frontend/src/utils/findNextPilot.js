function compareByStartOrder(a, b) {
  const ao = a.start_order;
  const bo = b.start_order;
  if (ao != null && bo != null) return ao - bo;
  if (ao != null) return -1;
  if (bo != null) return 1;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/**
 * Próximo piloto en la tanda actual (primera ronda con huecos pendientes).
 * @param {Array} participants
 * @param {number} totalRounds
 * @returns {{ participant: object, roundNumber: number } | null}
 */
export function findNextPilot(participants, totalRounds) {
  if (!Array.isArray(participants) || participants.length === 0 || !totalRounds) {
    return null;
  }

  const getRoundStatus = (participant, roundNumber) => {
    const round = participant.rounds?.find((r) => r.round_number === roundNumber);
    if (!round) return 'pending';
    if (round.did_not_participate) return 'dnp';
    if (round.time_timestamp != null && round.time_timestamp > 0) return 'completed';
    return 'pending';
  };

  for (let round = 1; round <= totalRounds; round += 1) {
    const pending = participants
      .filter((p) => getRoundStatus(p, round) === 'pending')
      .sort(compareByStartOrder);
    if (pending.length > 0) {
      return { participant: pending[0], roundNumber: round };
    }
  }

  return null;
}

export default findNextPilot;
