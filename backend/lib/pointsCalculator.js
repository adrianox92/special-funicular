// Calculadora de puntos centralizada para competiciones

/** @param {string|null|undefined} str */
function lapTimeStringToSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(':');
  if (parts.length < 2) return null;
  const min = parseFloat(parts[0]);
  const rest = parseFloat(parts[1]);
  if (Number.isNaN(min) || Number.isNaN(rest)) return null;
  return min * 60 + rest;
}

/** Válido para estadísticas: participó y la marca no es el centinela 00:00.000. */
function isUsableBestLapTimeString(str) {
  const s = lapTimeStringToSeconds(str);
  return s != null && s > 0;
}

const RULE_TYPES = ['per_round', 'final', 'best_time_per_round'];

/**
 * Reglas aplicables a una categoría: específicas de la categoría o fallback global (category_id null).
 * @param {Array} allRules
 * @param {string|null} categoryId
 */
function getRulesForCategory(allRules, categoryId) {
  const result = [];
  for (const ruleType of RULE_TYPES) {
    const specific = allRules.find(
      (r) => r.rule_type === ruleType && r.category_id === categoryId
    );
    if (specific) {
      result.push(specific);
      continue;
    }
    const fallback = allRules.find(
      (r) => r.rule_type === ruleType && (r.category_id == null || r.category_id === '')
    );
    if (fallback) {
      result.push(fallback);
    }
  }
  return result;
}

/**
 * Orden estándar: puntos desc → tiempo asc → rondas completadas desc.
 */
function sortByPointsThenTime(stats) {
  return stats.slice().sort((a, b) => {
    if (a.points !== b.points) {
      return b.points - a.points;
    }
    if (a.total_time_seconds && b.total_time_seconds) {
      return a.total_time_seconds - b.total_time_seconds;
    }
    if (a.total_time_seconds && !b.total_time_seconds) return -1;
    if (!a.total_time_seconds && b.total_time_seconds) return 1;
    if (a.rounds_completed !== b.rounds_completed) {
      return b.rounds_completed - a.rounds_completed;
    }
    return 0;
  });
}

/**
 * Núcleo del cálculo de puntos para un subconjunto de participantes y reglas.
 * @returns {{ pointsByParticipant: Object, participantStats: Array }}
 */
function calculatePointsCore({ competition, participants, timings, rules }) {
  const timesByParticipant = {};
  timings.forEach((timing) => {
    if (!timesByParticipant[timing.participant_id]) {
      timesByParticipant[timing.participant_id] = [];
    }
    timesByParticipant[timing.participant_id].push(timing);
  });

  const pointsByParticipant = {};
  participants.forEach((p) => {
    pointsByParticipant[p.id] = 0;
  });

  const perRoundRule = rules.find((r) => r.rule_type === 'per_round');
  const finalRule = rules.find((r) => r.rule_type === 'final');

  if (perRoundRule) {
    for (let round = 1; round <= competition.rounds; round++) {
      const roundTimings = participants
        .map((p) => (timesByParticipant[p.id] || []).find((t) => t.round_number === round))
        .filter(Boolean);

      if (roundTimings.length === participants.length) {
        const participatingTimings = roundTimings.filter((t) => !t.did_not_participate);
        const sorted = participatingTimings.slice().sort((a, b) => {
          const aTime = a.total_time
            ? parseFloat(a.total_time.split(':')[0]) * 60 + parseFloat(a.total_time.split(':')[1])
            : Infinity;
          const bTime = b.total_time
            ? parseFloat(b.total_time.split(':')[0]) * 60 + parseFloat(b.total_time.split(':')[1])
            : Infinity;
          const aPenalty = Number(a.penalty_seconds) || 0;
          const bPenalty = Number(b.penalty_seconds) || 0;
          return aTime + aPenalty - (bTime + bPenalty);
        });

        Object.entries(perRoundRule.points_structure).forEach(([, pts], idx) => {
          if (sorted[idx]) {
            pointsByParticipant[sorted[idx].participant_id] += pts;
          }
        });

        if (perRoundRule.use_bonus_best_lap && participatingTimings.length > 0) {
          let bestLapTiming = participatingTimings[0];
          participatingTimings.forEach((t) => {
            if (t.best_lap_time < bestLapTiming.best_lap_time) {
              bestLapTiming = t;
            }
          });
          const bestLapTied = participatingTimings.filter(
            (t) => t.best_lap_time === bestLapTiming.best_lap_time
          );
          if (bestLapTied.length === 1 && bestLapTiming?.participant_id) {
            pointsByParticipant[bestLapTiming.participant_id] += 1;
          }
        }
      }
    }
  }

  const totalRequiredTimes = participants.length * competition.rounds;
  const isCompleted = timings.length >= totalRequiredTimes;

  if (finalRule && isCompleted) {
    const participantTotalTimes = participants.map((p) => {
      const totalTime = (timesByParticipant[p.id] || [])
        .filter((timing) => !timing.did_not_participate)
        .reduce((total, timing) => {
          const timeInSeconds = timing.total_time
            ? parseFloat(timing.total_time.split(':')[0]) * 60 +
              parseFloat(timing.total_time.split(':')[1])
            : 0;
          const penalty = Number(timing.penalty_seconds) || 0;
          return total + timeInSeconds + penalty;
        }, 0);
      const hasAnyParticipation = (timesByParticipant[p.id] || []).some(
        (t) => !t.did_not_participate
      );
      return {
        participant_id: p.id,
        total_time: totalTime,
        has_participation: hasAnyParticipation,
      };
    });

    const finalSorted = participantTotalTimes.sort((a, b) => {
      if (a.has_participation !== b.has_participation) {
        return a.has_participation ? -1 : 1;
      }
      return a.total_time - b.total_time;
    });

    Object.entries(finalRule.points_structure).forEach(([, pts], idx) => {
      if (finalSorted[idx]?.has_participation) {
        pointsByParticipant[finalSorted[idx].participant_id] += pts;
      }
    });
  }

  const participantStats = participants.map((p) => {
    const participantTimings = timesByParticipant[p.id] || [];
    const roundsCompleted = participantTimings.length;
    const roundsDnp = participantTimings.filter((t) => t.did_not_participate).length;
    const roundsRemaining = competition.rounds - roundsCompleted;

    let totalTimeSeconds = 0;
    let bestLapTime = null;
    let totalLaps = 0;
    let totalPenalty = 0;

    participantTimings.forEach((timing) => {
      if (timing.did_not_participate) return;
      const timeParts = timing.total_time ? timing.total_time.split(':') : [0, 0];
      const timeInSeconds = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
      const penalty = Number(timing.penalty_seconds) || 0;
      totalTimeSeconds += timeInSeconds + penalty;
      totalPenalty += penalty;
      if (isUsableBestLapTimeString(timing.best_lap_time)) {
        const curLap = lapTimeStringToSeconds(timing.best_lap_time);
        const bestSoFar = bestLapTime != null ? lapTimeStringToSeconds(bestLapTime) : null;
        if (bestSoFar == null || curLap < bestSoFar) {
          bestLapTime = timing.best_lap_time;
        }
      }
      totalLaps += timing.laps;
    });

    const totalMinutes = Math.floor(totalTimeSeconds / 60);
    const totalSeconds = (totalTimeSeconds % 60).toFixed(3);
    const totalTimeFormatted =
      totalTimeSeconds > 0
        ? `${String(totalMinutes).padStart(2, '0')}:${totalSeconds.padStart(6, '0')}`
        : null;

    const teamNameRaw = p.team_name;
    const teamName =
      teamNameRaw != null && String(teamNameRaw).trim()
        ? String(teamNameRaw).trim()
        : null;

    return {
      participant_id: p.id,
      category_id: p.category_id || null,
      driver_name: p.driver_name,
      team_name: teamName,
      vehicle_info: p.vehicles
        ? `${p.vehicles.manufacturer} ${p.vehicles.model}`
        : p.vehicle_model,
      rounds_completed: roundsCompleted,
      rounds_dnp: roundsDnp,
      rounds_remaining: roundsRemaining,
      total_time: totalTimeFormatted,
      best_lap_time: bestLapTime,
      total_laps: totalLaps,
      total_time_seconds: totalTimeSeconds,
      penalty_seconds: totalPenalty,
      timings: participantTimings,
      points: pointsByParticipant[p.id] || 0,
    };
  });

  return { pointsByParticipant, participantStats };
}

/**
 * Calcula los puntos de los participantes según las reglas y los tiempos.
 * @param {Object} params
 * @param {Object} competition - Objeto de la competición (debe incluir rounds)
 * @param {Array} participants - Participantes oficiales (con id, category_id opcional)
 * @param {Array} timings - Tiempos registrados
 * @param {Array} rules - Reglas de puntuación
 * @param {Array} [categories] - Categorías de la competición ({ id, name })
 * @returns {Object} { pointsByParticipant, participantStats, sortedParticipants, categoryRankings? }
 */
function calculatePoints({ competition, participants, timings, rules, categories = [] }) {
  const safeRules = rules || [];
  const safeCategories = categories || [];
  const hasCategoryRules = safeRules.some((r) => r.category_id != null && r.category_id !== '');

  if (!hasCategoryRules) {
    const core = calculatePointsCore({ competition, participants, timings, rules: safeRules });
    const sortedParticipants = sortByPointsThenTime(core.participantStats);
    sortedParticipants.forEach((participant, index) => {
      participant.position = index + 1;
    });
    return {
      pointsByParticipant: core.pointsByParticipant,
      participantStats: core.participantStats,
      sortedParticipants,
      categoryRankings: [],
    };
  }

  const categoryRankings = [];
  const mergedPointsByParticipant = {};
  participants.forEach((p) => {
    mergedPointsByParticipant[p.id] = 0;
  });

  const categoriesWithParticipants = safeCategories.filter((cat) =>
    participants.some((p) => p.category_id === cat.id)
  );

  for (const cat of categoriesWithParticipants) {
    const catParticipants = participants.filter((p) => p.category_id === cat.id);
    const catParticipantIds = new Set(catParticipants.map((p) => p.id));
    const catTimings = timings.filter((t) => catParticipantIds.has(t.participant_id));
    const catRules = getRulesForCategory(safeRules, cat.id);

    const core = calculatePointsCore({
      competition,
      participants: catParticipants,
      timings: catTimings,
      rules: catRules,
    });

    Object.entries(core.pointsByParticipant).forEach(([pid, pts]) => {
      mergedPointsByParticipant[pid] = pts;
    });

    const sortedCat = sortByPointsThenTime(core.participantStats);
    sortedCat.forEach((participant, index) => {
      participant.position = index + 1;
    });

    categoryRankings.push({
      category_id: cat.id,
      category_name: cat.name,
      sortedParticipants: sortedCat,
      pointsByParticipant: core.pointsByParticipant,
    });
  }

  const uncategorizedParticipants = participants.filter((p) => !p.category_id);
  if (uncategorizedParticipants.length > 0) {
    const uncategorizedIds = new Set(uncategorizedParticipants.map((p) => p.id));
    const uncategorizedTimings = timings.filter((t) => uncategorizedIds.has(t.participant_id));
    const globalRules = getRulesForCategory(safeRules, null);

    const core = calculatePointsCore({
      competition,
      participants: uncategorizedParticipants,
      timings: uncategorizedTimings,
      rules: globalRules,
    });

    Object.entries(core.pointsByParticipant).forEach(([pid, pts]) => {
      mergedPointsByParticipant[pid] = pts;
    });
  }

  const globalCore = calculatePointsCore({
    competition,
    participants,
    timings,
    rules: [],
  });

  const participantStats = globalCore.participantStats.map((stat) => ({
    ...stat,
    points: mergedPointsByParticipant[stat.participant_id] || 0,
  }));

  const sortedParticipants = sortByPointsThenTime(participantStats);
  sortedParticipants.forEach((participant, index) => {
    participant.position = index + 1;
  });

  return {
    pointsByParticipant: mergedPointsByParticipant,
    participantStats,
    sortedParticipants,
    categoryRankings,
  };
}

module.exports = {
  calculatePoints,
  getRulesForCategory,
  lapTimeStringToSeconds,
  isUsableBestLapTimeString,
};
