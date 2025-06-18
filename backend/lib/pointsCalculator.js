// Calculadora de puntos centralizada para competiciones

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
      // Tiempos de la ronda
      const roundTimings = participants.map(p =>
        (timesByParticipant[p.id] || []).find(t => t.round_number === round)
      ).filter(Boolean);
      // Solo sumar puntos si todos los participantes han registrado tiempo en la ronda
      if (roundTimings.length === participants.length) {
        // Ordenar por tiempo total ajustado ascendente (mejor primero)
        const sorted = roundTimings.slice().sort((a, b) => {
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
        // Bonus por mejor vuelta de la ronda
        if (perRoundRule.use_bonus_best_lap) {
          let bestLapTiming = roundTimings[0];
          roundTimings.forEach(t => {
            if (t.best_lap_time < bestLapTiming.best_lap_time) {
              bestLapTiming = t;
            }
          });
          // Verificar si hay empate
          const bestLapTied = roundTimings.filter(t => t.best_lap_time === bestLapTiming.best_lap_time);
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
    // Calcular tiempo total por participante
    const participantTotalTimes = participants.map(p => {
      const totalTime = (timesByParticipant[p.id] || []).reduce((total, timing) => {
        const timeInSeconds = timing.total_time ? parseFloat(timing.total_time.split(':')[0]) * 60 + parseFloat(timing.total_time.split(':')[1]) : 0;
        const penalty = Number(timing.penalty_seconds) || 0;
        return total + timeInSeconds + penalty;
      }, 0);
      return {
        participant_id: p.id,
        total_time: totalTime
      };
    });
    // Ordenar por tiempo total ascendente (mejor primero)
    const finalSorted = participantTotalTimes.sort((a, b) => a.total_time - b.total_time);
    // Asignar puntos finales
    Object.entries(finalRule.points_structure).forEach(([pos, pts], idx) => {
      if (finalSorted[idx]) {
        pointsByParticipant[finalSorted[idx].participant_id] += pts;
      }
    });
  }

  // Calcular estadísticas por participante (ahora con los puntos ya calculados)
  const participantStats = participants.map(p => {
    const participantTimings = timesByParticipant[p.id] || [];
    const roundsCompleted = participantTimings.length;
    const roundsRemaining = competition.rounds - roundsCompleted;
    // Calcular tiempo total acumulado
    let totalTimeSeconds = 0;
    let bestLapTime = null;
    let totalLaps = 0;
    let totalPenalty = 0;
    participantTimings.forEach(timing => {
      const timeParts = timing.total_time ? timing.total_time.split(':') : [0,0];
      const timeInSeconds = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
      const penalty = Number(timing.penalty_seconds) || 0;
      totalTimeSeconds += timeInSeconds + penalty;
      totalPenalty += penalty;
      // Actualizar mejor vuelta
      if (!bestLapTime || timing.best_lap_time < bestLapTime) {
        bestLapTime = timing.best_lap_time;
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

module.exports = { calculatePoints }; 