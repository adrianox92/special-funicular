'use strict';

const XLSX = require('xlsx');
const { lapTimeStringToSeconds } = require('./pointsCalculator');

function formatDiff(leader, cur) {
  if (leader == null || cur == null) return '';
  const d = cur - leader;
  if (d <= 0 || Number.isNaN(d)) return '';
  const minutes = Math.floor(d / 60);
  const sec = (d % 60).toFixed(3);
  return `+${String(minutes).padStart(2, '0')}:${sec.padStart(6, '0')}`;
}

function timingSec(timing) {
  if (timing.did_not_participate) return null;
  const ts = Number(timing.total_time_timestamp);
  if (!Number.isNaN(ts) && ts > 0) return ts;
  return lapTimeStringToSeconds(timing.total_time);
}

/**
 * @param {object} ctx — payload de exportación (`competition`, `timings`, `rules`, `sortedParticipants`)
 */
function generateCompetitionXLSX(ctx) {
  const { competition, timings, rules, sortedParticipants } = ctx;
  const wb = XLSX.utils.book_new();

  const hasPoints =
    (rules && rules.length > 0) || sortedParticipants.some((p) => (p.points || 0) > 0);
  const leaderSec = sortedParticipants[0]?.total_time_seconds || null;

  const classifHeader = [
    'Posición',
    'Piloto',
    'Vehículo',
    'Rondas',
    'Mejor vuelta',
    'Tiempo total',
    'Penalización (s)',
    'Dif. líder',
    'Dif. anterior',
  ];
  if (hasPoints) classifHeader.push('Puntos');

  const classifRows = [classifHeader];

  sortedParticipants.forEach((p, index) => {
    const prev = index > 0 ? sortedParticipants[index - 1] : null;
    const row = [
      p.position,
      p.driver_name || '',
      p.vehicle_info || '',
      p.rounds_completed,
      p.best_lap_time || '',
      p.total_time || '',
      p.penalty_seconds != null ? Number(p.penalty_seconds) : 0,
      formatDiff(leaderSec, p.total_time_seconds),
      prev && prev.total_time_seconds != null && p.total_time_seconds != null
        ? formatDiff(prev.total_time_seconds, p.total_time_seconds)
        : '',
    ];
    if (hasPoints) row.push(p.points != null ? p.points : 0);
    classifRows.push(row);
  });

  const sh1 = XLSX.utils.aoa_to_sheet(classifRows);
  XLSX.utils.book_append_sheet(wb, sh1, 'Clasificación');

  const roundHeader = [
    'Ronda',
    'Piloto',
    'Vehículo',
    'NP',
    'Mejor vuelta',
    'Vueltas',
    'Tiempo total',
    'Penalización (s)',
    'Carril',
  ];
  const roundRows = [roundHeader];

  timings
    .slice()
    .sort(
      (a, b) =>
        a.round_number - b.round_number ||
        String(a.best_lap_time || '').localeCompare(String(b.best_lap_time || ''))
    )
    .forEach((timing) => {
      const sp = sortedParticipants.find((x) => x.participant_id === timing.participant_id);
      const pen = Number(timing.penalty_seconds) || 0;
      roundRows.push([
        timing.round_number,
        sp ? sp.driver_name : '',
        sp ? sp.vehicle_info : '',
        timing.did_not_participate ? 'Sí' : 'No',
        timing.best_lap_time || '',
        timing.laps != null ? timing.laps : '',
        timing.total_time || '',
        pen,
        timing.lane || '',
      ]);
    });

  const sh2 = XLSX.utils.aoa_to_sheet(roundRows);
  XLSX.utils.book_append_sheet(wb, sh2, 'Por ronda');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generateCompetitionXLSX,
};
