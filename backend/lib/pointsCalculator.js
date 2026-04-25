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

/**
 * Calcula los puntos de los participantes según las reglas y los tiempos.
 * @param {Object} params
 * @param {Object} competition - Objeto de la competición (debe incluir rounds)
 * @param {Array} participants - Participantes oficiales (con id)
 * @param {Array} timings - Tiempos registrados (con penalty_seconds)
 * @param {Array} rules - Reglas de puntuación (por ronda, final, bonus)
 * @returns {Object} { pointsByParticipant, participantStats, sortedParticipants }
 */
function calculatePoints({ competition, participants, timings, rules }) {
  // Agrupar tiempos por participante
  const timesByParticipant = {};
  timings.forEach(timing => {
    if (!timesByParticipant[timing.participant_id]) {
      timesByParticipant[timing.participant_id] = [];
    }
    timesByParticipant[timing.participant_id].push(timing);
  });

  // Inicializar puntos por participante
  const pointsByParticipant = {};
  participants.forEach(p => { pointsByParticipant[p.id] = 0; });

  const perRoundRule = rules.find(r => r.rule_type === 'per_round');
  const finalRule = rules.find(r => r.rule_type === 'final');

  // Puntuación por ronda
  if (perRoundRule) {
    for (let round = 1; round <= competition.rounds; round++) {
      // Tiempos de la ronda (incluye NP para desbloquear el reparto)
      const roundTimings = participants.map(p =>
        (timesByParticipant[p.id] || []).find(t => t.round_number === round)
      ).filter(Boolean);
      // Solo sumar puntos si todos los participantes han registrado tiempo (o NP) en la ronda
      if (roundTimings.length === participants.length) {
        // Los NP no reciben puntos por posición; solo los que realmente participaron
        const participatingTimings = roundTimings.filter(t => !t.did_not_participate);
        // Ordenar por tiempo total ajustado ascendente (mejor primero)
        const sorted = participatingTimings.slice().sort((a, b) => {
          const aTime = a.total_time ? parseFloat(a.total_time.split(':')[0]) * 60 + parseFloat(a.total_time.split(':')[1]) : Infinity;
          const bTime = b.total_time ? parseFloat(b.total_time.split(':')[0]) * 60 + parseFloat(b.total_time.split(':')[1]) : Infinity;
          const aPenalty = Number(a.penalty_seconds) || 0;
          const bPenalty = Number(b.penalty_seconds) || 0;
          return (aTime + aPenalty) - (bTime + bPenalty);
        });
        // Asignar puntos por posición en la ronda
        Object.entries(perRoundRule.points_structure).forEach(([pos, pts], idx) => {
          if (sorted[idx]) {
            pointsByParticipant[sorted[idx].participant_id] += pts;
          }
        });
        // Bonus por mejor vuelta de la ronda (ignorando NP)
        if (perRoundRule.use_bonus_best_lap && participatingTimings.length > 0) {
          let bestLapTiming = participatingTimings[0];
          participatingTimings.forEach(t => {
            if (t.best_lap_time < bestLapTiming.best_lap_time) {
              bestLapTiming = t;
            }
          });
          // Verificar si hay empate
          const bestLapTied = participatingTimings.filter(t => t.best_lap_time === bestLapTiming.best_lap_time);
          if (bestLapTied.length === 1 && bestLapTiming && bestLapTiming.participant_id) {
            pointsByParticipant[bestLapTiming.participant_id] += 1; // 1 punto adicional por mejor vuelta
          }
        }
      }
    }
  }

  // Puntuación final (solo si la competición está completada)
  const totalRequiredTimes = participants.length * competition.rounds;
  const isCompleted = timings.length >= totalRequiredTimes;
  if (finalRule && isCompleted) {
    // Calcular tiempo total por participante (ignorando rondas NP)
    const participantTotalTimes = participants.map(p => {
      const totalTime = (timesByParticipant[p.id] || [])
        .filter(timing => !timing.did_not_participate)
        .reduce((total, timing) => {
          const timeInSeconds = timing.total_time ? parseFloat(timing.total_time.split(':')[0]) * 60 + parseFloat(timing.total_time.split(':')[1]) : 0;
          const penalty = Number(timing.penalty_seconds) || 0;
          return total + timeInSeconds + penalty;
        }, 0);
      const hasAnyParticipation = (timesByParticipant[p.id] || []).some(t => !t.did_not_participate);
      return {
        participant_id: p.id,
        total_time: totalTime,
        has_participation: hasAnyParticipation,
      };
    });
    // Ordenar por tiempo total ascendente (mejor primero). Los que no participaron
    // en ninguna ronda se mandan al final para que no reciban puntos finales.
    const finalSorted = participantTotalTimes.sort((a, b) => {
      if (a.has_participation !== b.has_participation) {
        return a.has_participation ? -1 : 1;
      }
      return a.total_time - b.total_time;
    });
    // Asignar puntos finales (solo a los que tengan alguna participación real)
    Object.entries(finalRule.points_structure).forEach(([pos, pts], idx) => {
      if (finalSorted[idx] && finalSorted[idx].has_participation) {
        pointsByParticipant[finalSorted[idx].participant_id] += pts;
      }
    });
  }

  // Calcular estadísticas por participante (ahora con los puntos ya calculados)
  const participantStats = participants.map(p => {
    const participantTimings = timesByParticipant[p.id] || [];
    const roundsCompleted = participantTimings.length;
    const roundsDnp = participantTimings.filter(t => t.did_not_participate).length;
    const roundsRemaining = competition.rounds - roundsCompleted;
    // Calcular tiempo total acumulado (ignorando rondas NP)
    let totalTimeSeconds = 0;
    let bestLapTime = null;
    let totalLaps = 0;
    let totalPenalty = 0;
    participantTimings.forEach(timing => {
      if (timing.did_not_participate) return;
      const timeParts = timing.total_time ? timing.total_time.split(':') : [0,0];
      const timeInSeconds = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
      const penalty = Number(timing.penalty_seconds) || 0;
      totalTimeSeconds += timeInSeconds + penalty;
      totalPenalty += penalty;
      // Actualizar mejor vuelta (ignorar centinela 00:00.000 y datos inválidos)
      if (isUsableBestLapTimeString(timing.best_lap_time)) {
        const curLap = lapTimeStringToSeconds(timing.best_lap_time);
        const bestSoFar = bestLapTime != null ? lapTimeStringToSeconds(bestLapTime) : null;
        if (bestSoFar == null || curLap < bestSoFar) {
          bestLapTime = timing.best_lap_time;
        }
      }
      totalLaps += timing.laps;
    });
    // Formatear tiempo total
    const totalMinutes = Math.floor(totalTimeSeconds / 60);
    const totalSeconds = (totalTimeSeconds % 60).toFixed(3);
    const totalTimeFormatted = totalTimeSeconds > 0 ? `${String(totalMinutes).padStart(2, '0')}:${totalSeconds.padStart(6, '0')}` : null;
    return {
      participant_id: p.id,
      driver_name: p.driver_name,
      vehicle_info: p.vehicles ? `${p.vehicles.manufacturer} ${p.vehicles.model}` : p.vehicle_model,
      rounds_completed: roundsCompleted,
      rounds_dnp: roundsDnp,
      rounds_remaining: roundsRemaining,
      total_time: totalTimeFormatted,
      best_lap_time: bestLapTime,
      total_laps: totalLaps,
      total_time_seconds: totalTimeSeconds,
      penalty_seconds: totalPenalty,
      timings: participantTimings,
      points: pointsByParticipant[p.id] || 0
    };
  });

  // Ordenar participantes por puntos, tiempo total y completitud
  const sortedParticipants = participantStats.slice().sort((a, b) => {
    // 1. Primero por puntos (descendente - más puntos primero)
    if (a.points !== b.points) {
      return b.points - a.points;
    }
    // 2. Si tienen los mismos puntos, por tiempo total (ascendente - mejor tiempo primero)
    if (a.total_time_seconds && b.total_time_seconds) {
      return a.total_time_seconds - b.total_time_seconds;
    }
    if (a.total_time_seconds && !b.total_time_seconds) return -1;
    if (!a.total_time_seconds && b.total_time_seconds) return 1;
    // 3. Si tienen el mismo tiempo, por completitud de rondas (descendente - más rondas primero)
    if (a.rounds_completed !== b.rounds_completed) {
      return b.rounds_completed - a.rounds_completed;
    }
    return 0;
  });
  // Añadir posición
  sortedParticipants.forEach((participant, index) => {
    participant.position = index + 1;
  });

  return {
    pointsByParticipant,
    participantStats,
    sortedParticipants
  };
}

module.exports = {
  calculatePoints,
  lapTimeStringToSeconds,
  isUsableBestLapTimeString
}; 