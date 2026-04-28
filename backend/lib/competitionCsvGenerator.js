'use strict';

const { lapTimeStringToSeconds } = require('./pointsCalculator');

function safeFilenamePart(name) {
  return String(name || 'competicion').replace(/[^a-zA-Z0-9]/g, '_');
}

function formatTimeCell(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string' && value.includes(':')) return value;
  const t = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(t)) return String(value);
  const minutes = Math.floor(t / 60);
  const remainingSeconds = (t % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
}

function formatDiffSeconds(leaderSec, curSec) {
  if (leaderSec == null || curSec == null) return '-';
  const d = curSec - leaderSec;
  if (d <= 0 || Number.isNaN(d)) return '-';
  const minutes = Math.floor(d / 60);
  const sec = (d % 60).toFixed(3);
  return `+${String(minutes).padStart(2, '0')}:${sec.padStart(6, '0')}`;
}

function timingTotalSeconds(timing) {
  if (timing.did_not_participate) return null;
  const ts = Number(timing.total_time_timestamp);
  if (!Number.isNaN(ts) && ts > 0) return ts;
  return lapTimeStringToSeconds(timing.total_time);
}

/**
 * @param {object} params
 * @param {object} params.competition
 * @param {Array} params.timings
 * @param {Array} params.rules
 * @param {Array} params.sortedParticipants — de calculatePoints
 */
function generateCompetitionCSV({ competition, timings, rules, sortedParticipants }) {
  const hasPoints = (rules && rules.length > 0) || sortedParticipants.some((p) => (p.points || 0) > 0);
  const leaderSec = sortedParticipants[0]?.total_time_seconds || null;

  let csvContent = '';
  csvContent += `Competición: ${competition.name}\n`;
  csvContent += `Circuito: ${competition.circuit_name || 'No especificado'}\n`;
  csvContent += `Rondas: ${competition.rounds}\n`;
  csvContent += `Participantes: ${sortedParticipants.length}\n`;
  csvContent += `Fecha de exportación: ${new Date().toLocaleString('es-ES')}\n\n`;

  csvContent += '=== CLASIFICACIÓN GENERAL ===\n';
  const head = [
    'Posición',
    'Piloto',
    'Vehículo',
    'Rondas completadas',
    'Mejor vuelta',
    'Tiempo total',
    'Penalización total (s)',
    'Dif. líder',
    'Dif. anterior',
  ];
  if (hasPoints) head.push('Puntos');
  csvContent += `${head.join(',')}\n`;

  sortedParticipants.forEach((p, index) => {
    const prev = index > 0 ? sortedParticipants[index - 1] : null;
    const diffLeader = formatDiffSeconds(leaderSec, p.total_time_seconds);
    const diffPrev =
      prev && prev.total_time_seconds != null && p.total_time_seconds != null
        ? formatDiffSeconds(prev.total_time_seconds, p.total_time_seconds)
        : '-';

    const row = [
      p.position,
      `"${(p.driver_name || '').replace(/"/g, '""')}"`,
      `"${(p.vehicle_info || '').replace(/"/g, '""')}"`,
      p.rounds_completed,
      formatTimeCell(p.best_lap_time),
      p.total_time || '-',
      (p.penalty_seconds != null ? Number(p.penalty_seconds).toFixed(3) : '0'),
      diffLeader,
      diffPrev,
    ];
    if (hasPoints) row.push(p.points != null ? p.points : 0);
    csvContent += `${row.join(',')}\n`;
  });

  csvContent += '\n=== DATOS POR RONDA ===\n';
  csvContent +=
    'Ronda,Piloto,Vehículo,NP,Mejor Vuelta,Vueltas,Tiempo Total (s raw),Tiempo Total,Penalización (s),Tiempo Ajustado (s),Tiempo Promedio,Carril\n';

  const byRound = timings.slice().sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number;
    return String(a.best_lap_time || '').localeCompare(String(b.best_lap_time || ''));
  });

  byRound.forEach((timing) => {
    const sp = sortedParticipants.find((x) => x.participant_id === timing.participant_id);
    const pilot = sp ? sp.driver_name : '';
    const veh = sp ? sp.vehicle_info : '';
    const np = timing.did_not_participate ? 'Sí' : 'No';
    const baseSec = timingTotalSeconds(timing);
    const penalty = Number(timing.penalty_seconds) || 0;
    const adjusted = baseSec != null ? baseSec + penalty : '';

    csvContent += `${timing.round_number},`;
    csvContent += `"${String(pilot).replace(/"/g, '""')}",`;
    csvContent += `"${String(veh).replace(/"/g, '""')}",`;
    csvContent += `${np},`;
    csvContent += `${formatTimeCell(timing.best_lap_time)},`;
    csvContent += `${timing.laps != null ? timing.laps : ''},`;
    csvContent += `${baseSec != null ? baseSec.toFixed(3) : ''},`;
    csvContent += `${timing.total_time || ''},`;
    csvContent += `${penalty.toFixed(3)},`;
    csvContent += `${adjusted !== '' ? Number(adjusted).toFixed(3) : ''},`;
    csvContent += `${formatTimeCell(timing.average_time)},`;
    csvContent += `${timing.lane || ''}\n`;
  });

  return csvContent;
}

module.exports = {
  generateCompetitionCSV,
  safeFilenamePart,
};
